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
        except PyMongoError:
            self._collection = None

    def is_mongo_enabled(self) -> bool:
        return self._collection is not None

    def add_resource(self, resource: dict[str, Any]) -> dict[str, Any]:
        payload = {
            **resource,
            "created_at": datetime.utcnow(),
        }

        if self._collection is not None:
            result = self._collection.insert_one(payload)
            payload["id"] = str(result.inserted_id)
            return payload

        payload["id"] = f"mem-{len(self._memory_resources) + 1}"
        self._memory_resources.append(payload)
        return payload

    def list_resources(
        self,
        organization: str,
        project: str | None = None,
        environment: str | None = None,
    ) -> list[dict[str, Any]]:
        if self._collection is not None:
            query: dict[str, Any] = {"organization": organization}
            if project:
                query["project"] = project
            if environment:
                query["environment"] = environment

            rows = list(
                self._collection.find(query).sort(
                    [
                        ("project", 1),
                        ("environment", 1),
                        ("name", 1),
                    ]
                )
            )
            resources: list[dict[str, Any]] = []
            for row in rows:
                row["id"] = str(row.pop("_id"))
                resources.append(row)
            return resources

        rows = [r for r in self._memory_resources if r.get("organization") == organization]
        if project:
            rows = [r for r in rows if r.get("project") == project]
        if environment:
            rows = [r for r in rows if r.get("environment") == environment]

        rows.sort(key=lambda x: (x.get("project", ""), x.get("environment", ""), x.get("name", "")))
        return rows
