from bson import ObjectId
from datetime import datetime
from typing import Dict, List, Optional
import logging
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.models.schemas import (
    CreateFlowRequest,
    EnvironmentConfig,
    EnvKeyValue,
    UpdateEnvValuesRequest,
    SaveProjectRepoTemplateRequest,
)
from app.services.azure_service import get_azure_service

logger = logging.getLogger(__name__)


class FlowService:
    """Service for flow operations."""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.flows_col = db["flows"]
        self.snapshots_col = db["snapshots"]
        self.audit_col = db["audit_logs"]
        self.templates_col = db["flow_templates"]

    async def save_template(self, request: SaveProjectRepoTemplateRequest) -> Dict:
        """Create or update a project/repo environment template."""
        now = datetime.utcnow()
        existing = await self.templates_col.find_one(
            {
                "project": request.project.strip(),
                "repo": request.repo.strip(),
            }
        )

        if existing:
            await self.templates_col.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "repo_url": request.repo_url,
                        "resource_type": request.resource_type.value,
                        "environments": [
                            {
                                "name": env.name,
                                "resource_name": env.resource_name,
                                "resource_group": env.resource_group,
                                "subscription_id": env.subscription_id,
                            }
                            for env in request.environments
                        ],
                        "updated_at": now,
                        "updated_by": request.saved_by,
                    }
                },
            )
            updated_doc = await self.templates_col.find_one({"_id": existing["_id"]})
            return self._serialize_template(updated_doc)

        doc = {
            "project": request.project.strip(),
            "repo": request.repo.strip(),
            "repo_url": request.repo_url,
            "resource_type": request.resource_type.value,
            "environments": [
                {
                    "name": env.name,
                    "resource_name": env.resource_name,
                    "resource_group": env.resource_group,
                    "subscription_id": env.subscription_id,
                }
                for env in request.environments
            ],
            "created_at": now,
            "updated_at": now,
            "updated_by": request.saved_by,
        }
        result = await self.templates_col.insert_one(doc)
        doc["_id"] = result.inserted_id
        return self._serialize_template(doc)

    async def list_templates(self) -> List[Dict]:
        """List all templates sorted by project/repo."""
        docs = await self.templates_col.find({}).sort([("project", 1), ("repo", 1)]).to_list(length=500)
        return [self._serialize_template(doc) for doc in docs]
    
    async def create_flow(self, request: CreateFlowRequest) -> Dict:
        """Create a new flow with initial environment configuration."""
        now = datetime.utcnow()
        
        flow_doc = {
            "flow_name": request.flow_name,
            "repo_url": request.repo_url,
            "resource_type": request.resource_type.value,
            "resource_name": request.resource_name,
            "resource_group": request.resource_group,
            "subscription_id": request.subscription_id,
            "environments": [
                {
                    "name": env.name,
                    "resource_name": env.resource_name,
                    "resource_group": env.resource_group,
                    "subscription_id": env.subscription_id,
                    "values": [{"key": v.key, "value": v.value} for v in env.values]
                }
                for env in request.environments
            ],
            "tags": {
                "release_name": request.tags.release_name,
                "release_id": request.tags.release_id
            },
            "created_by": request.created_by,
            "created_at": now,
            "updated_at": now,
            "status": "active"
        }
        
        result = await self.flows_col.insert_one(flow_doc)
        flow_doc["_id"] = result.inserted_id
        
        # Create initial snapshot (post-creation)
        await self._create_snapshot(
            flow_id=result.inserted_id,
            environments=request.environments,
            snapshot_type="post_change",
            created_by=request.created_by,
            change_reason="Flow created"
        )
        
        # Log audit
        await self._log_audit(
            flow_id=result.inserted_id,
            action="flow_created",
            performed_by=request.created_by,
            details={"flow_name": request.flow_name, "release_id": request.tags.release_id}
        )
        
        return self._serialize_flow(flow_doc)
    
    async def get_flow(self, flow_id: str) -> Optional[Dict]:
        """Retrieve flow by ID."""
        try:
            flow = await self.flows_col.find_one({"_id": ObjectId(flow_id)})
            return self._serialize_flow(flow) if flow else None
        except:
            return None
    
    async def list_flows(self, limit: int = 50, skip: int = 0, status: str = "active") -> List[Dict]:
        """List flows with pagination."""
        flows = await self.flows_col.find(
            {"status": status}
        ).skip(skip).limit(limit).to_list(length=limit)
        return [self._serialize_flow(f) for f in flows]
    
    async def update_env_values(self, flow_id: str, request: UpdateEnvValuesRequest) -> Dict:
        """Update environment values for a key across specified environments."""
        try:
            flow_oid = ObjectId(flow_id)
        except:
            raise ValueError("Invalid flow ID")
        
        flow = await self.flows_col.find_one({"_id": flow_oid})
        if not flow:
            raise ValueError(f"Flow {flow_id} not found")
        
        # Create pre-change snapshot
        old_envs = [EnvironmentConfig.model_validate({
            "name": e["name"],
            "values": [EnvKeyValue.model_validate(v) for v in e["values"]]
        }) for e in flow["environments"]]
        
        await self._create_snapshot(
            flow_id=flow_oid,
            environments=old_envs,
            snapshot_type="pre_change",
            created_by=request.updated_by,
            change_reason=f"Updated key: {request.key}"
        )
        
        # Update values - validate key consistency
        updated_envs = flow["environments"]
        existing_keys_per_env = {
            env["name"]: {v["key"] for v in env["values"]}
            for env in updated_envs
        }
        
        # Ensure requested environments exist
        for env_name in request.values.keys():
            if env_name not in existing_keys_per_env:
                raise ValueError(f"Environment '{env_name}' not found in this flow")
        
        # Apply updates. If key does not exist in an environment, add it.
        for i, env in enumerate(updated_envs):
            if env["name"] in request.values:
                updated = False
                for j, kv in enumerate(env["values"]):
                    if kv["key"] == request.key:
                        updated_envs[i]["values"][j]["value"] = request.values[env["name"]]
                        updated = True
                        break
                if not updated:
                    updated_envs[i]["values"].append(
                        {"key": request.key, "value": request.values[env["name"]]}
                    )
        
        # Save updated flow
        now = datetime.utcnow()
        await self.flows_col.update_one(
            {"_id": flow_oid},
            {
                "$set": {
                    "environments": updated_envs,
                    "updated_at": now,
                    "updated_by": request.updated_by
                }
            }
        )
        
        # Create post-change snapshot
        new_envs = [EnvironmentConfig.model_validate({
            "name": e["name"],
            "values": [EnvKeyValue.model_validate(v) for v in e["values"]]
        }) for e in updated_envs]
        
        await self._create_snapshot(
            flow_id=flow_oid,
            environments=new_envs,
            snapshot_type="post_change",
            created_by=request.updated_by,
            change_reason=f"Updated key: {request.key}"
        )
        
        # Log audit
        await self._log_audit(
            flow_id=flow_oid,
            action="env_value_updated",
            performed_by=request.updated_by,
            details={"key": request.key, "environments": list(request.values.keys())}
        )
        
        updated_flow = await self.flows_col.find_one({"_id": flow_oid})
        return self._serialize_flow(updated_flow)
    
    async def get_snapshots(self, flow_id: str, limit: int = 20) -> List[Dict]:
        """Retrieve snapshots for a flow."""
        try:
            flow_oid = ObjectId(flow_id)
        except:
            return []
        
        snapshots = await self.snapshots_col.find(
            {"flow_id": flow_oid}
        ).sort("created_at", -1).limit(limit).to_list(length=limit)
        return [self._serialize_snapshot(s) for s in snapshots]
    
    async def get_snapshot(self, snapshot_id: str) -> Optional[Dict]:
        """Retrieve a specific snapshot."""
        try:
            snapshot = await self.snapshots_col.find_one({"_id": ObjectId(snapshot_id)})
            return self._serialize_snapshot(snapshot) if snapshot else None
        except:
            return None
    
    async def rollback_to_snapshot(
        self,
        flow_id: str,
        snapshot_id: str,
        rolled_back_by: str
    ) -> Dict:
        """
        Rollback environment values to a previous snapshot.
        
        - Restores all environments from specified snapshot
        - Preserves current resource details (resource_name, resource_group, subscription_id)
        - Creates post-rollback snapshot for audit trail
        """
        try:
            flow_oid = ObjectId(flow_id)
            snap_oid = ObjectId(snapshot_id)
        except:
            raise ValueError("Invalid ID")
        
        flow = await self.flows_col.find_one({"_id": flow_oid})
        snapshot = await self.snapshots_col.find_one({"_id": snap_oid})
        
        if not flow or not snapshot:
            raise ValueError("Flow or snapshot not found")
        
        if snapshot["flow_id"] != flow_oid:
            raise ValueError("Snapshot does not belong to this flow")
        
        # Step 1: Create pre-rollback snapshot with current flow state
        # (preserving current state before restoration)
        old_envs = [EnvironmentConfig.model_validate({
            "name": e["name"],
            "resource_name": e.get("resource_name"),
            "resource_group": e.get("resource_group"),
            "subscription_id": e.get("subscription_id"),
            "values": [EnvKeyValue.model_validate(v) for v in e.get("values", [])]
        }) for e in flow["environments"]]
        
        await self._create_snapshot(
            flow_id=flow_oid,
            environments=old_envs,
            snapshot_type="pre_change",
            created_by=rolled_back_by,
            change_reason=f"Pre-rollback: Current state before restoring snapshot {snapshot_id}"
        )
        
        # Step 2: Restore ALL environments from selected snapshot
        # PRESERVE resource details from current flow + restore VALUES from snapshot
        snapshot_envs_by_name = {e["name"]: e for e in snapshot["environments"]}
        current_envs_by_name = {e["name"]: e for e in flow["environments"]}
        
        merged_envs = []
        
        # For each environment in snapshot, restore values but keep current resource details
        for snapshot_env in snapshot["environments"]:
            env_name = snapshot_env["name"]
            current_env = current_envs_by_name.get(env_name)
            
            # Build restored environment with:
            # - Values from snapshot (restored)
            # - Resource details from current flow (preserved)
            restored_env = {
                "name": snapshot_env["name"],
                "values": snapshot_env.get("values", [])  # Restore values from snapshot
            }
            
            # Preserve current resource details
            if current_env:
                if current_env.get("resource_name"):
                    restored_env["resource_name"] = current_env["resource_name"]
                if current_env.get("resource_group"):
                    restored_env["resource_group"] = current_env["resource_group"]
                if current_env.get("subscription_id"):
                    restored_env["subscription_id"] = current_env["subscription_id"]
            
            merged_envs.append(restored_env)
        
        # Then, append any new environments from current flow that weren't in the snapshot
        for current_env in flow["environments"]:
            if current_env["name"] not in snapshot_envs_by_name:
                merged_envs.append(current_env)

        # Step 3: Apply restored values to Azure so rollback is effective on the target resource.
        azure_svc = get_azure_service()
        azure_failures = {}
        resource_type = flow.get("resource_type")

        for restored_env in merged_envs:
            env_name = restored_env.get("name")
            restored_values = {
                kv.get("key"): kv.get("value")
                for kv in restored_env.get("values", [])
                if kv.get("key") is not None
            }

            # Nothing to apply for this environment.
            if not restored_values:
                continue

            resource_name = restored_env.get("resource_name") or flow.get("resource_name")
            resource_group = restored_env.get("resource_group") or flow.get("resource_group")
            subscription_id = restored_env.get("subscription_id") or flow.get("subscription_id")

            # If this environment has no target resource mapping, skip Azure apply.
            if not resource_name or not resource_group:
                continue

            # Read current app settings and merge so unrelated existing keys are preserved.
            if resource_type == "webapp":
                current_settings = await azure_svc.get_webapp_settings(
                    resource_group=resource_group,
                    webapp_name=resource_name,
                    subscription_id=subscription_id
                )
            elif resource_type == "function_app":
                current_settings = await azure_svc.get_function_app_settings(
                    resource_group=resource_group,
                    function_app_name=resource_name,
                    subscription_id=subscription_id
                )
            else:
                azure_failures[env_name] = f"Unknown resource type: {resource_type}"
                continue

            if current_settings is None:
                azure_failures[env_name] = "Failed to read current Azure settings"
                continue

            merged_settings = dict(current_settings)
            merged_settings.update(restored_values)

            if resource_type == "webapp":
                success, message, _ = await azure_svc.apply_to_webapp(
                    resource_group=resource_group,
                    webapp_name=resource_name,
                    env_variables=merged_settings,
                    subscription_id=subscription_id
                )
            else:
                success, message, _ = await azure_svc.apply_to_function_app(
                    resource_group=resource_group,
                    function_app_name=resource_name,
                    env_variables=merged_settings,
                    subscription_id=subscription_id
                )

            if not success:
                azure_failures[env_name] = message

        if azure_failures:
            failure_summary = "; ".join([f"{k}: {v}" for k, v in azure_failures.items()])
            raise ValueError(f"Rollback aborted: failed to apply restored settings to Azure. {failure_summary}")
        
        now = datetime.utcnow()
        
        await self.flows_col.update_one(
            {"_id": flow_oid},
            {
                "$set": {
                    "environments": merged_envs,
                    "updated_at": now,
                    "updated_by": rolled_back_by
                }
            }
        )
        
        # Step 4: Create post-rollback snapshot
        new_envs = [EnvironmentConfig.model_validate({
            "name": e["name"],
            "resource_name": e.get("resource_name"),
            "resource_group": e.get("resource_group"),
            "subscription_id": e.get("subscription_id"),
            "values": [EnvKeyValue.model_validate(v) for v in e.get("values", [])]
        }) for e in merged_envs]
        
        await self._create_snapshot(
            flow_id=flow_oid,
            environments=new_envs,
            snapshot_type="post_change",
            created_by=rolled_back_by,
            change_reason=f"Rollback completed from snapshot {snapshot_id}"
        )
        
        # Log audit
        await self._log_audit(
            flow_id=flow_oid,
            action="flow_rolled_back",
            performed_by=rolled_back_by,
            details={
                "snapshot_id": snapshot_id,
                "environments": "all"
            }
        )
        
        updated_flow = await self.flows_col.find_one({"_id": flow_oid})
        return self._serialize_flow(updated_flow)
    
    async def archive_flow(self, flow_id: str, archived_by: str) -> Dict:
        """Archive a flow."""
        try:
            flow_oid = ObjectId(flow_id)
        except:
            raise ValueError("Invalid flow ID")
        
        result = await self.flows_col.update_one(
            {"_id": flow_oid},
            {
                "$set": {
                    "status": "archived",
                    "updated_at": datetime.utcnow(),
                    "updated_by": archived_by
                }
            }
        )
        
        if result.matched_count == 0:
            raise ValueError("Flow not found")
        
        # Log audit
        await self._log_audit(
            flow_id=flow_oid,
            action="flow_archived",
            performed_by=archived_by
        )
        
        flow = await self.flows_col.find_one({"_id": flow_oid})
        return self._serialize_flow(flow)
    
    # Helper methods
    async def _create_snapshot(
        self,
        flow_id: ObjectId,
        environments: List[EnvironmentConfig],
        snapshot_type: str,
        created_by: str,
        change_reason: str
    ):
        """Create a snapshot of environment configuration."""
        # Build environments list, only including non-null resource fields
        snapshot_envs = []
        for env in environments:
            env_doc = {
                "name": env.name,
                "values": [{"key": v.key, "value": v.value} for v in env.values]
            }
            # Only add resource fields if they're not None
            if env.resource_name:
                env_doc["resource_name"] = env.resource_name
            if env.resource_group:
                env_doc["resource_group"] = env.resource_group
            if env.subscription_id:
                env_doc["subscription_id"] = env.subscription_id
            snapshot_envs.append(env_doc)
        
        snapshot_doc = {
            "flow_id": flow_id,
            "snapshot_type": snapshot_type,
            "environments": snapshot_envs,
            "created_at": datetime.utcnow(),
            "created_by": created_by,
            "change_reason": change_reason
        }
        await self.snapshots_col.insert_one(snapshot_doc)
    
    async def _log_audit(
        self,
        flow_id: ObjectId,
        action: str,
        performed_by: str,
        details: Optional[Dict] = None
    ):
        """Log an audit entry."""
        audit_doc = {
            "flow_id": flow_id,
            "action": action,
            "performed_by": performed_by,
            "performed_at": datetime.utcnow(),
            "details": details or {}
        }
        await self.audit_col.insert_one(audit_doc)
    
    @staticmethod
    def _serialize_flow(doc) -> Dict:
        """Convert MongoDB document to JSON-serializable dict."""
        return {
            "id": str(doc["_id"]),
            "flow_name": doc["flow_name"],
            "repo_url": doc["repo_url"],
            "resource_type": doc["resource_type"],
            "resource_name": doc["resource_name"],
            "resource_group": doc["resource_group"],
            "subscription_id": doc.get("subscription_id"),
            "environments": doc["environments"],
            "tags": doc["tags"],
            "created_by": doc["created_by"],
            "created_at": doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else doc["created_at"],
            "updated_at": doc["updated_at"].isoformat() if isinstance(doc["updated_at"], datetime) else doc["updated_at"],
            "updated_by": doc.get("updated_by"),
            "status": doc.get("status", "active")
        }
    
    @staticmethod
    def _serialize_snapshot(doc) -> Dict:
        """Convert snapshot document to JSON-serializable dict."""
        # Handle environments and ensure resource fields are not null
        environments = []
        for env in doc.get("environments", []):
            env_dict = {
                "name": env.get("name"),
                "values": env.get("values", [])
            }
            # Only include resource fields if they have values (not null)
            if env.get("resource_name"):
                env_dict["resource_name"] = env.get("resource_name")
            if env.get("resource_group"):
                env_dict["resource_group"] = env.get("resource_group")
            if env.get("subscription_id"):
                env_dict["subscription_id"] = env.get("subscription_id")
            environments.append(env_dict)
        
        return {
            "id": str(doc["_id"]),
            "flow_id": str(doc["flow_id"]),
            "snapshot_type": doc["snapshot_type"],
            "environments": environments,
            "created_at": doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else doc["created_at"],
            "created_by": doc["created_by"],
            "change_reason": doc.get("change_reason")
        }

    @staticmethod
    def _serialize_template(doc) -> Dict:
        """Convert template document to JSON-serializable dict."""
        environments = []
        for env in doc.get("environments", []):
            environments.append(
                {
                    "name": env.get("name"),
                    "resource_name": env.get("resource_name"),
                    "resource_group": env.get("resource_group"),
                    "subscription_id": env.get("subscription_id"),
                    "values": [],
                }
            )

        return {
            "id": str(doc["_id"]),
            "project": doc["project"],
            "repo": doc["repo"],
            "repo_url": doc.get("repo_url"),
            "resource_type": doc.get("resource_type", "webapp"),
            "environments": environments,
            "created_at": doc["created_at"].isoformat() if isinstance(doc["created_at"], datetime) else doc["created_at"],
            "updated_at": doc["updated_at"].isoformat() if isinstance(doc["updated_at"], datetime) else doc["updated_at"],
            "updated_by": doc.get("updated_by", "system"),
        }
    
    async def apply_to_azure(
        self,
        flow_id: str,
        environments_to_apply: Optional[List[str]] = None,
        approved_by: str = None
    ) -> Dict:
        """
        Apply environment variables to Azure WebApp or Function App.
        
        IMPORTANT: Merges with existing Azure settings.
        - Reads current settings from Azure
        - Merges with flow values (only updates specified keys)
        - Backs up current Azure state before applying
        - Never removes unrelated existing settings
        
        Args:
            flow_id: Flow ID
            environments_to_apply: List of environment names to apply (None = all)
            approved_by: Email of approver
        
        Returns:
            Dict with status, message, applied_envs, failed_envs
        """
        try:
            flow_oid = ObjectId(flow_id)
        except:
            raise ValueError("Invalid flow ID")
        
        flow = await self.flows_col.find_one({"_id": flow_oid})
        if not flow:
            raise ValueError("Flow not found")
        
        # Determine which environments to apply
        all_env_names = [env["name"] for env in flow["environments"]]
        envs_to_apply = environments_to_apply or all_env_names
        
        # Validate requested environments exist
        for env_name in envs_to_apply:
            if env_name not in all_env_names:
                raise ValueError(f"Environment '{env_name}' not found in flow")
        
        # Get Azure service
        azure_svc = get_azure_service()
        
        applied_envs = []
        failed_envs = []
        skipped_envs = []
        error_details = {}
        azure_backup_envs = []  # Track backups of current Azure state
        
        # Apply to each environment
        for flow_env in flow["environments"]:
            env_name = flow_env["name"]
            
            if env_name not in envs_to_apply:
                continue
            
            # Build key-value dict from flow for this environment
            flow_vars = {kv["key"]: kv["value"] for kv in flow_env["values"]}

            # Skip if this environment has no values configured in flow
            if not flow_vars:
                skipped_envs.append(env_name)
                continue

            resource_name = flow_env.get("resource_name") or flow.get("resource_name")
            resource_group = flow_env.get("resource_group") or flow.get("resource_group")
            subscription_id = flow_env.get("subscription_id") or flow.get("subscription_id")
            resource_type = flow.get("resource_type")

            if not resource_name or not resource_group:
                failed_envs.append(env_name)
                error_details[env_name] = "Missing resource_name/resource_group for this environment"
                continue
            
            # Step 1: Read CURRENT settings from Azure
            current_azure_settings = None
            if resource_type == "webapp":
                current_azure_settings = await azure_svc.get_webapp_settings(
                    resource_group=resource_group,
                    webapp_name=resource_name,
                    subscription_id=subscription_id
                )
            elif resource_type == "function_app":
                current_azure_settings = await azure_svc.get_function_app_settings(
                    resource_group=resource_group,
                    function_app_name=resource_name,
                    subscription_id=subscription_id
                )
            
            if current_azure_settings is None:
                failed_envs.append(env_name)
                error_details[env_name] = "Could not read current settings from Azure"
                continue
            
            # Step 2: Backup current Azure state
            backup_values = [{
                "key": k,
                "value": v
            } for k, v in current_azure_settings.items()]
            
            azure_backup_envs.append(EnvironmentConfig.model_validate({
                "name": env_name,
                "resource_name": resource_name,
                "resource_group": resource_group,
                "subscription_id": subscription_id,
                "values": backup_values
            }))
            
            # Step 3: Merge: Keep all current Azure settings + update with flow values
            merged_vars = dict(current_azure_settings)  # Start with all 12 existing
            merged_vars.update(flow_vars)  # Update only the keys in flow
            
            # Step 4: Apply merged settings to Azure
            if resource_type == "webapp":
                success, message, details = await azure_svc.apply_to_webapp(
                    resource_group=resource_group,
                    webapp_name=resource_name,
                    env_variables=merged_vars,
                    subscription_id=subscription_id
                )
            elif resource_type == "function_app":
                success, message, details = await azure_svc.apply_to_function_app(
                    resource_group=resource_group,
                    function_app_name=resource_name,
                    env_variables=merged_vars,
                    subscription_id=subscription_id
                )
            else:
                success = False
                message = f"Unknown resource type: {resource_type}"
                details = {}
            
            if success:
                applied_envs.append(env_name)
            else:
                failed_envs.append(env_name)
                error_details[env_name] = details.get("error", message)
        
        # Step 5: Create pre-apply snapshot with current Azure state (backup)
        if azure_backup_envs:
            await self._create_snapshot(
                flow_id=flow_oid,
                environments=azure_backup_envs,
                snapshot_type="pre_change",
                created_by=approved_by or "system",
                change_reason="Pre-apply: Backup of current Azure settings before applying flow values"
            )
        
        # Log result
        await self._log_audit(
            flow_id=flow_oid,
            action="flow_applied",
            performed_by=approved_by or "system",
            details={
                "resource_type": flow.get("resource_type"),
                "applied_envs": applied_envs,
                "failed_envs": failed_envs,
                "skipped_envs": skipped_envs,
                "note": "Current Azure state backed up before applying"
            }
        )
        
        status = "success" if not failed_envs else ("partial" if applied_envs else "failed")
        message = f"Applied to {len(applied_envs)} environment(s)"
        if skipped_envs:
            message += f"; skipped {len(skipped_envs)} empty environment(s)"
        if not applied_envs and failed_envs:
            message = "Failed to apply to any environment"

        return {
            "flow_id": flow_id,
            "status": status,
            "message": message,
            "applied_at": datetime.utcnow().isoformat(),
            "applied_envs": applied_envs,
            "failed_envs": failed_envs,
            "error_details": error_details if error_details else None,
            "skipped_envs": skipped_envs,
            "resource_type": flow.get("resource_type")
        }
