from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

from pymongo import MongoClient
from pymongo.errors import PyMongoError

from .config import settings
from .env_azure_service import get_env_azure_service


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class EnvFlowStore:
    def __init__(self) -> None:
        self._flows_mem: list[dict[str, Any]] = []
        self._snapshots_mem: list[dict[str, Any]] = []
        self._templates_mem: list[dict[str, Any]] = []
        self._audit_mem: list[dict[str, Any]] = []
        self._flows_collection = None
        self._snapshots_collection = None
        self._templates_collection = None
        self._audit_collection = None

        if not settings.mongodb_uri:
            return

        try:
            client = MongoClient(settings.mongodb_uri, serverSelectionTimeoutMS=1500)
            db = client[settings.mongodb_database]
            self._flows_collection = db["env_flows"]
            self._snapshots_collection = db["env_flow_snapshots"]
            self._templates_collection = db["env_flow_templates"]
            self._audit_collection = db["env_flow_audit"]
            self._flows_collection.create_index([("status", 1), ("created_at", -1)])
            self._templates_collection.create_index([("project", 1), ("repo", 1)], unique=True)
            self._snapshots_collection.create_index([("flow_id", 1), ("created_at", -1)])
        except PyMongoError:
            self._flows_collection = None
            self._snapshots_collection = None
            self._templates_collection = None
            self._audit_collection = None

    def save_template(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = _utcnow()
        project = payload["project"].strip()
        repo = payload["repo"].strip()
        document = {
            "project": project,
            "repo": repo,
            "repo_url": payload.get("repo_url") or None,
            "resource_type": payload["resource_type"],
            "environments": [
                {
                    "name": env["name"].strip(),
                    "resource_name": (env.get("resource_name") or "").strip() or None,
                    "resource_group": (env.get("resource_group") or "").strip() or None,
                    "subscription_id": (env.get("subscription_id") or "").strip() or None,
                    "values": [],
                }
                for env in payload["environments"]
            ],
            "updated_at": now,
            "updated_by": payload["saved_by"],
        }

        if self._templates_collection is not None:
            existing = self._templates_collection.find_one({"project": project, "repo": repo})
            if existing:
                self._templates_collection.update_one({"_id": existing["_id"]}, {"$set": document})
                row = self._templates_collection.find_one({"_id": existing["_id"]})
                assert row is not None
                return self._serialize(row)

            document["created_at"] = now
            result = self._templates_collection.insert_one(document)
            document["_id"] = result.inserted_id
            return self._serialize(document)

        for row in self._templates_mem:
            if row["project"] == project and row["repo"] == repo:
                row.update(document)
                return deepcopy(row)

        document["id"] = f"template-{len(self._templates_mem) + 1}"
        document["created_at"] = now
        self._templates_mem.append(document)
        return deepcopy(document)

    def list_templates(self) -> list[dict[str, Any]]:
        if self._templates_collection is not None:
            rows = list(self._templates_collection.find({}).sort([("project", 1), ("repo", 1)]))
            return [self._serialize(row) for row in rows]

        rows = sorted(self._templates_mem, key=lambda item: (item["project"], item["repo"]))
        return [deepcopy(row) for row in rows]

    def create_flow(self, payload: dict[str, Any]) -> dict[str, Any]:
        now = _utcnow()
        document = {
            "flow_name": payload["flow_name"].strip(),
            "repo_url": payload["repo_url"].strip(),
            "resource_type": payload["resource_type"],
            "resource_name": (payload.get("resource_name") or "").strip() or None,
            "resource_group": (payload.get("resource_group") or "").strip() or None,
            "subscription_id": (payload.get("subscription_id") or "").strip() or None,
            "environments": self._normalize_environments(payload["environments"]),
            "tags": {
                "release_name": payload["tags"]["release_name"].strip(),
                "release_id": payload["tags"]["release_id"].strip(),
            },
            "created_by": payload["created_by"],
            "created_at": now,
            "updated_at": now,
            "status": "active",
        }

        if self._flows_collection is not None:
            result = self._flows_collection.insert_one(document)
            document["_id"] = result.inserted_id
            flow = self._serialize(document)
            self._create_snapshot(flow["id"], flow["environments"], "post_change", payload["created_by"], "Flow created")
            self._log_audit(flow["id"], "flow_created", payload["created_by"], {"flow_name": flow["flow_name"]})
            return flow

        document["id"] = f"flow-{len(self._flows_mem) + 1}"
        self._flows_mem.append(document)
        self._create_snapshot(document["id"], document["environments"], "post_change", payload["created_by"], "Flow created")
        self._log_audit(document["id"], "flow_created", payload["created_by"], {"flow_name": document["flow_name"]})
        return deepcopy(document)

    def list_flows(self, status: str = "active") -> list[dict[str, Any]]:
        if self._flows_collection is not None:
            rows = list(self._flows_collection.find({"status": status}).sort([("created_at", -1)]))
            return [self._serialize(row) for row in rows]

        rows = [row for row in self._flows_mem if row.get("status") == status]
        rows.sort(key=lambda item: item["created_at"], reverse=True)
        return [deepcopy(row) for row in rows]

    def get_flow(self, flow_id: str) -> dict[str, Any] | None:
        if self._flows_collection is not None:
            row = self._find_by_id(self._flows_collection, flow_id)
            return self._serialize(row) if row else None

        for row in self._flows_mem:
            if row.get("id") == flow_id:
                return deepcopy(row)
        return None

    def update_flow_values(self, flow_id: str, key: str, values: dict[str, str], updated_by: str) -> dict[str, Any] | None:
        flow = self.get_flow(flow_id)
        if not flow:
            return None

        self._create_snapshot(flow_id, flow["environments"], "pre_change", updated_by, f"Updated key: {key}")

        environments = deepcopy(flow["environments"])
        known_names = {env["name"] for env in environments}
        if any(env_name not in known_names for env_name in values):
            raise ValueError("One or more environments do not exist in this flow")

        for env in environments:
            if env["name"] not in values:
                continue
            for item in env["values"]:
                if item["key"] == key:
                    item["value"] = values[env["name"]]
                    break
            else:
                env["values"].append({"key": key, "value": values[env["name"]]})

        updated_at = _utcnow()
        self._persist_flow_update(flow_id, {"environments": environments, "updated_at": updated_at})
        self._create_snapshot(flow_id, environments, "post_change", updated_by, f"Updated key: {key}")
        self._log_audit(flow_id, "env_value_updated", updated_by, {"key": key, "environments": list(values.keys())})
        return self.get_flow(flow_id)

    def list_snapshots(self, flow_id: str) -> list[dict[str, Any]]:
        if self._snapshots_collection is not None:
            rows = list(self._snapshots_collection.find({"flow_id": flow_id}).sort([("created_at", -1)]))
            return [self._serialize(row) for row in rows]

        rows = [row for row in self._snapshots_mem if row.get("flow_id") == flow_id]
        rows.sort(key=lambda item: item["created_at"], reverse=True)
        return [deepcopy(row) for row in rows]

    def _merge_snapshot_environments(
        self,
        current_environments: list[dict[str, Any]],
        snapshot_environments: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        current_by_name = {env["name"]: env for env in current_environments}
        restored = []

        for env in snapshot_environments:
            current = current_by_name.get(env["name"], {})
            restored.append(
                {
                    "name": env["name"],
                    "resource_name": current.get("resource_name") or env.get("resource_name"),
                    "resource_group": current.get("resource_group") or env.get("resource_group"),
                    "subscription_id": current.get("subscription_id") or env.get("subscription_id"),
                    "values": deepcopy(env.get("values", [])),
                }
            )

        restored_names = {item["name"] for item in restored}
        for env in current_environments:
            if env["name"] not in restored_names:
                restored.append(deepcopy(env))

        return restored

    def _resolve_resource_target(
        self,
        flow: dict[str, Any],
        environment: dict[str, Any],
    ) -> tuple[str | None, str | None, str | None, str | None]:
        return (
            environment.get("resource_name") or flow.get("resource_name"),
            environment.get("resource_group") or flow.get("resource_group"),
            environment.get("subscription_id") or flow.get("subscription_id"),
            flow.get("resource_type"),
        )

    async def _read_current_settings(
        self,
        azure_service: Any,
        resource_type: str | None,
        resource_group: str,
        resource_name: str,
        subscription_id: str | None,
    ) -> dict[str, str] | None:
        if resource_type == "webapp":
            return await azure_service.get_webapp_settings(resource_group, resource_name, subscription_id)
        if resource_type == "function_app":
            return await azure_service.get_function_app_settings(resource_group, resource_name, subscription_id)
        return None

    async def _apply_settings(
        self,
        azure_service: Any,
        resource_type: str | None,
        resource_group: str,
        resource_name: str,
        merged_settings: dict[str, str],
        subscription_id: str | None,
    ) -> tuple[bool, str, dict[str, Any]]:
        if resource_type == "webapp":
            return await azure_service.apply_to_webapp(resource_group, resource_name, merged_settings, subscription_id)
        if resource_type == "function_app":
            return await azure_service.apply_to_function_app(resource_group, resource_name, merged_settings, subscription_id)
        return False, f"Unknown resource type: {resource_type}", {}

    async def _apply_environment_payload(
        self,
        flow: dict[str, Any],
        environment: dict[str, Any],
        payload_values: dict[str, str],
    ) -> tuple[bool, str]:
        env_name = environment.get("name") or "unknown"
        resource_name, resource_group, subscription_id, resource_type = self._resolve_resource_target(flow, environment)
        if not resource_name or not resource_group:
            return False, "Missing resource_name/resource_group for this environment"

        azure_service = get_env_azure_service()
        current_settings = await self._read_current_settings(
            azure_service,
            resource_type,
            resource_group,
            resource_name,
            subscription_id,
        )
        if current_settings is None:
            return False, "Could not read current settings from Azure"

        merged_settings = dict(current_settings)
        merged_settings.update(payload_values)
        success, message, details = await self._apply_settings(
            azure_service,
            resource_type,
            resource_group,
            resource_name,
            merged_settings,
            subscription_id,
        )
        if success:
            return True, env_name
        return False, details.get("error", message)

    def _build_apply_status(self, applied_envs: list[str], failed_envs: list[str]) -> tuple[str, str]:
        if applied_envs and not failed_envs:
            return "success", f"Applied {len(applied_envs)} environment(s) successfully."
        if applied_envs:
            return "partial", f"Applied {len(applied_envs)} environment(s); {len(failed_envs)} failed."
        return "failed", "No environments were applied successfully."

    async def rollback_flow(self, flow_id: str, snapshot_id: str, rolled_back_by: str) -> dict[str, Any] | None:
        flow = self.get_flow(flow_id)
        snapshot = self.get_snapshot(snapshot_id)
        if not flow or not snapshot or snapshot.get("flow_id") != flow_id:
            return None

        self._create_snapshot(flow_id, flow["environments"], "pre_change", rolled_back_by, f"Pre-rollback to {snapshot_id}")

        restored = self._merge_snapshot_environments(flow["environments"], snapshot["environments"])
        azure_failures: dict[str, str] = {}

        for environment in restored:
            env_name = environment.get("name") or "unknown"
            restored_values = {
                item.get("key"): item.get("value")
                for item in environment.get("values", [])
                if item.get("key") is not None
            }
            if not restored_values:
                continue

            success, message = await self._apply_environment_payload(flow, environment, restored_values)
            if not success:
                azure_failures[env_name] = message

        if azure_failures:
            failure_summary = "; ".join(f"{name}: {reason}" for name, reason in azure_failures.items())
            raise ValueError(f"Rollback aborted: failed to apply restored settings to Azure. {failure_summary}")

        self._persist_flow_update(flow_id, {"environments": restored, "updated_at": _utcnow()})
        self._create_snapshot(flow_id, restored, "post_change", rolled_back_by, f"Rolled back to snapshot {snapshot_id}")
        self._log_audit(flow_id, "flow_rollback", rolled_back_by, {"snapshot_id": snapshot_id})
        return self.get_flow(flow_id)

    async def apply_flow(self, flow_id: str, environments: list[str] | None, approved_by: str, approval_reason: str | None) -> dict[str, Any] | None:
        flow = self.get_flow(flow_id)
        if not flow:
            return None

        requested = environments or [env["name"] for env in flow["environments"]]
        known_names = {env["name"] for env in flow["environments"]}
        invalid = [name for name in requested if name not in known_names]
        if invalid:
            raise ValueError(f"Unknown environment(s): {', '.join(invalid)}")

        applied_envs: list[str] = []
        failed_envs: list[str] = []
        error_details: dict[str, str] = {}

        for environment in flow["environments"]:
            env_name = environment["name"]
            if env_name not in requested:
                continue

            flow_vars = {item["key"]: item["value"] for item in environment.get("values", [])}
            if not flow_vars:
                continue

            success, message = await self._apply_environment_payload(flow, environment, flow_vars)
            if success:
                applied_envs.append(env_name)
            else:
                failed_envs.append(env_name)
                error_details[env_name] = message

        applied_at = _utcnow()
        self._log_audit(
            flow_id,
            "flow_apply",
            approved_by,
            {
                "environments": requested,
                "approval_reason": approval_reason,
                "applied_at": applied_at.isoformat(),
                "errors": error_details,
            },
        )
        self._persist_flow_update(flow_id, {"updated_at": applied_at})
        status, message = self._build_apply_status(applied_envs, failed_envs)
        return {
            "flow_id": flow_id,
            "status": status,
            "message": message,
            "applied_at": applied_at,
            "applied_envs": applied_envs,
            "failed_envs": failed_envs,
        }

    def get_snapshot(self, snapshot_id: str) -> dict[str, Any] | None:
        if self._snapshots_collection is not None:
            row = self._find_by_id(self._snapshots_collection, snapshot_id)
            return self._serialize(row) if row else None

        for row in self._snapshots_mem:
            if row.get("id") == snapshot_id:
                return deepcopy(row)
        return None

    def _persist_flow_update(self, flow_id: str, payload: dict[str, Any]) -> None:
        if self._flows_collection is not None:
            row = self._find_by_id(self._flows_collection, flow_id)
            if row is not None:
                self._flows_collection.update_one({"_id": row["_id"]}, {"$set": payload})
            return

        for row in self._flows_mem:
            if row.get("id") == flow_id:
                row.update(deepcopy(payload))
                return

    def _create_snapshot(
        self,
        flow_id: str,
        environments: list[dict[str, Any]],
        snapshot_type: str,
        created_by: str,
        change_reason: str | None,
    ) -> None:
        snapshot = {
            "flow_id": flow_id,
            "snapshot_type": snapshot_type,
            "environments": deepcopy(environments),
            "created_at": _utcnow(),
            "created_by": created_by,
            "change_reason": change_reason,
        }

        if self._snapshots_collection is not None:
            self._snapshots_collection.insert_one(snapshot)
            return

        snapshot["id"] = f"snapshot-{len(self._snapshots_mem) + 1}"
        self._snapshots_mem.append(snapshot)

    def _log_audit(self, flow_id: str, action: str, performed_by: str, details: dict[str, Any]) -> None:
        entry = {
            "flow_id": flow_id,
            "action": action,
            "performed_by": performed_by,
            "details": deepcopy(details),
            "created_at": _utcnow(),
        }

        if self._audit_collection is not None:
            self._audit_collection.insert_one(entry)
            return

        entry["id"] = f"audit-{len(self._audit_mem) + 1}"
        self._audit_mem.append(entry)

    def _normalize_environments(self, environments: list[dict[str, Any]]) -> list[dict[str, Any]]:
        normalized_names: set[str] = set()
        normalized: list[dict[str, Any]] = []

        for env in environments:
            name = env["name"].strip()
            lowered = name.lower()
            if lowered in normalized_names:
                raise ValueError(f"Duplicate environment name: {name}")
            normalized_names.add(lowered)
            normalized.append(
                {
                    "name": name,
                    "resource_name": (env.get("resource_name") or "").strip() or None,
                    "resource_group": (env.get("resource_group") or "").strip() or None,
                    "subscription_id": (env.get("subscription_id") or "").strip() or None,
                    "values": [
                        {"key": item["key"].strip(), "value": item.get("value", "")}
                        for item in env.get("values", [])
                        if item.get("key", "").strip()
                    ],
                }
            )

        return normalized

    def _serialize(self, row: dict[str, Any] | None) -> dict[str, Any] | None:
        if row is None:
            return None
        payload = dict(row)
        if "_id" in payload:
            payload["id"] = str(payload.pop("_id"))
        return payload

    def _find_by_id(self, collection: Any, item_id: str) -> dict[str, Any] | None:
        try:
            from bson import ObjectId

            return collection.find_one({"_id": ObjectId(item_id)})
        except Exception:
            return None