from __future__ import annotations

from datetime import datetime
from typing import Any

from pymongo import MongoClient
from pymongo.errors import PyMongoError

from .config import settings


class ResourceStore:
    def __init__(self) -> None:
        self._memory_resources: list[dict[str, Any]] = []
        self._collection = None

        if not settings.mongodb_uri:
            return

        try:
            client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=1500)
            db = client[settings.mongodb_database]
            self._collection = db[settings.mongodb_collection]
            self._collection.create_index(
                [("organization", 1), ("project", 1), ("environment", 1), ("name", 1)]
            )
            self._collection.create_index(
                [("owner_email", 1), ("dashboard_id", 1), ("project", 1), ("environment", 1), ("name", 1)]
            )
        except PyMongoError:
            self._collection = None

    def add_resource(self, resource: dict[str, Any]) -> dict[str, Any]:
        payload = {**resource, "created_at": datetime.utcnow()}

        if self._collection is not None:
            result = self._collection.insert_one(payload)
            payload["id"] = str(result.inserted_id)
            return payload

        payload["id"] = f"mem-{len(self._memory_resources) + 1}"
        self._memory_resources.append(payload)
        return payload

    def list_resources(
        self,
        organization: str | None = None,
        project: str | None = None,
        environment: str | None = None,
        owner_email: str | None = None,
        dashboard_id: str | None = None,
    ) -> list[dict[str, Any]]:
        query: dict[str, Any] = {}
        if organization:
            query["organization"] = organization
        if owner_email:
            query["owner_email"] = owner_email
        if dashboard_id:
            query["dashboard_id"] = dashboard_id
        if project:
            query["project"] = project
        if environment:
            query["environment"] = environment

        if self._collection is not None:
            rows = list(
                self._collection.find(query).sort(
                    [("project", 1), ("environment", 1), ("name", 1)]
                )
            )
            resources: list[dict[str, Any]] = []
            for row in rows:
                row["id"] = str(row.pop("_id"))
                resources.append(row)
            return resources

        rows = self._memory_resources
        for key, value in query.items():
            rows = [r for r in rows if r.get(key) == value]

        rows.sort(key=lambda x: (x.get("project", ""), x.get("environment", ""), x.get("name", "")))
        return rows


    def get_resource(self, resource_id: str) -> dict[str, Any] | None:
        if self._collection is not None:
            from bson import ObjectId

            try:
                oid = ObjectId(resource_id)
            except Exception:
                return None
            row = self._collection.find_one({"_id": oid})
            if not row:
                return None
            row["id"] = str(row.pop("_id"))
            return row

        for row in self._memory_resources:
            if row.get("id") == resource_id:
                return row
        return None

    def update_resource(self, resource_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
        if self._collection is not None:
            from bson import ObjectId

            try:
                oid = ObjectId(resource_id)
            except Exception:
                return None
            self._collection.update_one({"_id": oid}, {"$set": payload})
            row = self._collection.find_one({"_id": oid})
            if not row:
                return None
            row["id"] = str(row.pop("_id"))
            return row

        for row in self._memory_resources:
            if row.get("id") == resource_id:
                row.update(payload)
                return row
        return None
