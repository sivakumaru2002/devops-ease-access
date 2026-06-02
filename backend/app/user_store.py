from __future__ import annotations

from datetime import datetime, timezone
import json
from typing import Any

from pymongo import MongoClient
from pymongo.errors import PyMongoError

from .auth import hash_password, verify_password
from .config import settings


VALID_USER_ROLES = {"admin", "devops", "tester"}
DEFAULT_USER_ROLE = "tester"


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

        self._ensure_bootstrap_users()

    def _normalize_role(self, role: str | None, is_admin: bool = False) -> str:
        normalized = str(role or "").strip().lower()
        if normalized in VALID_USER_ROLES:
            return normalized
        return "admin" if is_admin else DEFAULT_USER_ROLE

    def _serialize_user(self, row: dict[str, Any]) -> dict[str, Any]:
        payload = dict(row)
        if "_id" in payload:
            payload["id"] = str(payload.pop("_id"))
        payload["approved"] = bool(payload.get("approved"))
        payload["is_admin"] = bool(payload.get("is_admin"))
        payload["role"] = self._normalize_role(payload.get("role"), payload["is_admin"])
        payload["is_admin"] = payload["role"] == "admin" or payload["is_admin"]
        return payload

    def _utcnow(self) -> datetime:
        return datetime.now(timezone.utc)

    def _iter_bootstrap_users(self) -> list[tuple[str, str, str, str]]:
        if not settings.auth_users_json:
            return []

        try:
            configured_users = json.loads(settings.auth_users_json)
        except json.JSONDecodeError:
            return []

        bootstrap_users: list[tuple[str, str, str, str]] = []
        for item in configured_users:
            role = self._normalize_role(item.get("role"))
            email = str(item.get("email") or item.get("username") or "").strip().lower()
            username = str(item.get("username") or item.get("email") or "").strip()
            password = str(item.get("password") or "").strip()

            if email and username and password:
                bootstrap_users.append((email, username, password, role))

        return bootstrap_users

    def _ensure_bootstrap_users(self) -> None:
        for email, username, password, role in self._iter_bootstrap_users():
            if self.find_user(email) or self.find_user(username):
                continue

            self.create_user(
                email,
                username,
                password,
                approved=True,
                is_admin=role == "admin",
                role=role,
            )

        if self.find_user("admin@gmail.com"):
            return
        self.create_user("admin@gmail.com", "admin", "admin", approved=True, is_admin=True, role="admin")

    def _normalize(self, text: str) -> str:
        return text.strip().lower()

    def create_user(
        self,
        email: str,
        username: str,
        password: str,
        approved: bool = False,
        is_admin: bool = False,
        role: str | None = None,
    ) -> dict[str, Any]:
        email_n = self._normalize(email)
        username_n = username.strip()
        role_name = self._normalize_role(role, is_admin)
        payload = {
            "email": email_n,
            "username": username_n,
            "password_hash": hash_password(password),
            "approved": approved,
            "is_admin": role_name == "admin" or is_admin,
            "role": role_name,
            "created_at": self._utcnow(),
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
            return self._serialize_user(row)

        for user in self._users_mem:
            if user["email"] == email_n or user["username"] == value:
                return self._serialize_user(user)
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
            return [self._serialize_user(row) for row in rows]
        return [self._serialize_user(u) for u in self._users_mem if not u["approved"]]

    def approve_user(self, user_id: str, role: str | None = None) -> dict[str, Any] | None:
        role_name = self._normalize_role(role)
        is_admin = role_name == "admin"
        if self._users_collection is not None:
            from bson import ObjectId

            try:
                oid = ObjectId(user_id)
            except Exception:
                return None
            self._users_collection.update_one(
                {"_id": oid},
                {"$set": {"approved": True, "role": role_name, "is_admin": is_admin}},
            )
            row = self._users_collection.find_one({"_id": oid})
            if not row:
                return None
            return self._serialize_user(row)

        for user in self._users_mem:
            if user["id"] == user_id:
                user["approved"] = True
                user["role"] = role_name
                user["is_admin"] = is_admin
                return self._serialize_user(user)
        return None

    def create_dashboard(self, name: str, description: str | None, created_by: str) -> dict[str, Any]:
        payload = {
            "name": name.strip(),
            "description": description.strip() if description else None,
            "created_by": created_by,
            "created_at": self._utcnow(),
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


    def get_dashboard(self, dashboard_id: str) -> dict[str, Any] | None:
        if self._dashboards_collection is not None:
            from bson import ObjectId

            try:
                oid = ObjectId(dashboard_id)
            except Exception:
                return None
            row = self._dashboards_collection.find_one({"_id": oid})
            if not row:
                return None
            row["id"] = str(row.pop("_id"))
            return row

        for dashboard in self._dashboards_mem:
            if dashboard.get("id") == dashboard_id:
                return dashboard
        return None


    def set_devops_credentials(self, email: str, organization: str, encrypted_pat: str) -> dict[str, Any] | None:
        email_n = self._normalize(email)
        now = self._utcnow()

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
