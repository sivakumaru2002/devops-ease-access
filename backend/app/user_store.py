from __future__ import annotations

from datetime import datetime
from typing import Any

from pymongo import MongoClient
from pymongo.errors import PyMongoError

from .auth import hash_password, verify_password
from .config import settings


class UserStore:
    def __init__(self) -> None:
        self._users_mem: list[dict[str, Any]] = []
        self._dashboards_mem: list[dict[str, Any]] = []
        self._users_collection = None
        self._dashboards_collection = None

        if settings.mongodb_uri:
            try:
                client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=1500)
                db = client[settings.mongodb_database]
                self._users_collection = db["users"]
                self._dashboards_collection = db["dashboards"]
                self._users_collection.create_index("email", unique=True)
                self._users_collection.create_index("username", unique=True)
                self._dashboards_collection.create_index("name")
            except PyMongoError:
                self._users_collection = None
                self._dashboards_collection = None

        self._ensure_default_admin()

    def _ensure_default_admin(self) -> None:
        if self.find_user("admin@gmail.com"):
            return
        self.create_user("admin@gmail.com", "admin", "admin", approved=True, is_admin=True)

    def _normalize(self, text: str) -> str:
        return text.strip().lower()

    def create_user(self, email: str, username: str, password: str, approved: bool = False, is_admin: bool = False) -> dict[str, Any]:
        email_n = self._normalize(email)
        username_n = username.strip()
        payload = {
            "email": email_n,
            "username": username_n,
            "password_hash": hash_password(password),
            "approved": approved,
            "is_admin": is_admin,
            "created_at": datetime.utcnow(),
        }

        existing = self.find_user(email_n) or self.find_user(username_n)
        if existing:
            raise ValueError("User already exists")

        if self._users_collection is not None:
            result = self._users_collection.insert_one(payload)
            payload["id"] = str(result.inserted_id)
            return payload

        payload["id"] = f"user-{len(self._users_mem) + 1}"
        self._users_mem.append(payload)
        return payload

    def find_user(self, email_or_username: str) -> dict[str, Any] | None:
        value = email_or_username.strip()
        email_n = self._normalize(value)

        if self._users_collection is not None:
            row = self._users_collection.find_one({"$or": [{"email": email_n}, {"username": value}]})
            if not row:
                return None
            row["id"] = str(row.pop("_id"))
            return row

        for user in self._users_mem:
            if user["email"] == email_n or user["username"] == value:
                return user
        return None

    def verify_credentials(self, email_or_username: str, password: str) -> dict[str, Any] | None:
        user = self.find_user(email_or_username)
        if not user:
            return None
        if not verify_password(password, user["password_hash"]):
            return None
        return user

    def list_pending_users(self) -> list[dict[str, Any]]:
        if self._users_collection is not None:
            rows = list(self._users_collection.find({"approved": False}).sort([("created_at", 1)]))
            pending = []
            for row in rows:
                row["id"] = str(row.pop("_id"))
                pending.append(row)
            return pending
        return [u for u in self._users_mem if not u["approved"]]

    def approve_user(self, user_id: str) -> dict[str, Any] | None:
        if self._users_collection is not None:
            from bson import ObjectId

            try:
                oid = ObjectId(user_id)
            except Exception:
                return None
            self._users_collection.update_one({"_id": oid}, {"$set": {"approved": True}})
            row = self._users_collection.find_one({"_id": oid})
            if not row:
                return None
            row["id"] = str(row.pop("_id"))
            return row

        for user in self._users_mem:
            if user["id"] == user_id:
                user["approved"] = True
                return user
        return None

    def create_dashboard(self, name: str, description: str | None, created_by: str) -> dict[str, Any]:
        payload = {
            "name": name.strip(),
            "description": description.strip() if description else None,
            "created_by": created_by,
            "created_at": datetime.utcnow(),
        }

        if self._dashboards_collection is not None:
            result = self._dashboards_collection.insert_one(payload)
            payload["id"] = str(result.inserted_id)
            return payload

        payload["id"] = f"dashboard-{len(self._dashboards_mem) + 1}"
        self._dashboards_mem.append(payload)
        return payload

    def list_dashboards(self) -> list[dict[str, Any]]:
        if self._dashboards_collection is not None:
            rows = list(self._dashboards_collection.find().sort([("created_at", -1)]))
            result = []
            for row in rows:
                row["id"] = str(row.pop("_id"))
                result.append(row)
            return result
        return sorted(self._dashboards_mem, key=lambda d: d["created_at"], reverse=True)


    def set_devops_credentials(self, email: str, organization: str, encrypted_pat: str) -> dict[str, Any] | None:
        email_n = self._normalize(email)
        now = datetime.utcnow()

        if self._users_collection is not None:
            self._users_collection.update_one(
                {"email": email_n},
                {"$set": {
                    "devops_org": organization.strip(),
                    "devops_pat_encrypted": encrypted_pat,
                    "devops_updated_at": now,
                }},
            )
            row = self._users_collection.find_one({"email": email_n})
            if not row:
                return None
            row["id"] = str(row.pop("_id"))
            return row

        for user in self._users_mem:
            if user["email"] == email_n:
                user["devops_org"] = organization.strip()
                user["devops_pat_encrypted"] = encrypted_pat
                user["devops_updated_at"] = now
                return user
        return None

    def get_devops_credentials(self, email: str) -> dict[str, Any] | None:
        email_n = self._normalize(email)
        user = self.find_user(email_n)
        if not user:
            return None
        return {
            "organization": user.get("devops_org"),
            "encrypted_pat": user.get("devops_pat_encrypted"),
            "updated_at": user.get("devops_updated_at"),
        }
