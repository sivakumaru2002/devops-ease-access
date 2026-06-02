from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from app.auth import CurrentUser, get_current_user, require_roles
from app.db.mongodb import get_db
from app.models.schemas import (
    CreateFlowRequest, UpdateEnvValuesRequest, FlowResponse, SnapshotResponse,
    ApplyRequestPayload, ApplyResultResponse, ErrorResponse
)
from app.services.flow_service import FlowService
from app.services.azure_service import get_azure_service
from datetime import datetime

router = APIRouter(prefix="/api/v1/flows", tags=["Flows"])


@router.post("/", response_model=FlowResponse, status_code=status.HTTP_201_CREATED)
async def create_flow(
    request: CreateFlowRequest,
    current_user: CurrentUser = Depends(require_roles("admin", "devops")),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Create a new flow for environment variable management.
    
    - **flow_name**: Human-friendly name (e.g., "MyApp Staging Flow")
    - **repo_url**: Azure DevOps repository URL
    - **resource_type**: "webapp" or "function_app"
    - **resource_name**: Azure resource name
    - **resource_group**: Azure resource group name
    - **environments**: List of environments with key-value pairs (keys must be identical across all envs)
    - **tags**: Release metadata (release_name and release_id from Azure DevOps)
    - **created_by**: Username of creator
    """
    try:
        request = request.model_copy(update={"created_by": current_user.username})
        service = FlowService(db)
        flow = await service.create_flow(request)
        return FlowResponse(**flow)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating flow: {str(e)}")


@router.get("/{flow_id}", response_model=FlowResponse)
async def get_flow(
    flow_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Retrieve a flow by ID."""
    service = FlowService(db)
    flow = await service.get_flow(flow_id)
    
    if not flow:
        raise HTTPException(status_code=404, detail="Flow not found")
    
    return FlowResponse(**flow)


@router.get("/", response_model=list[FlowResponse])
async def list_flows(
    skip: int = 0,
    limit: int = 50,
    status: str = "active",
    _: CurrentUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    List flows with pagination.
    
    - **skip**: Number of flows to skip
    - **limit**: Max number of flows to return (max 100)
    - **status**: Filter by status ("active" or "archived")
    """
    if limit > 100:
        limit = 100
    
    service = FlowService(db)
    flows = await service.list_flows(limit=limit, skip=skip, status=status)
    return [FlowResponse(**f) for f in flows]


@router.patch("/{flow_id}/values")
async def update_env_values(
    flow_id: str,
    request: UpdateEnvValuesRequest,
    current_user: CurrentUser = Depends(require_roles("admin", "devops")),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Update environment values for a specific key.
    
    Rules:
    - Key must exist in all environments being updated
    - All environments in the request must exist in the flow
    - Values are updated, not replaced
    
    Example:
    ```json
    {
        "key": "DB_CONNECTION_STRING",
        "values": {
            "stage": "new-stage-value",
            "preprod": "new-preprod-value",
            "prod": "new-prod-value"
        },
        "updated_by": "user@company.com"
    }
    ```
    """
    try:
        request = request.model_copy(update={"updated_by": current_user.username})
        service = FlowService(db)
        flow = await service.update_env_values(flow_id, request)
        return FlowResponse(**flow)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating values: {str(e)}")


@router.get("/{flow_id}/snapshots", response_model=list[SnapshotResponse])
async def get_snapshots(
    flow_id: str,
    limit: int = 20,
    _: CurrentUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Retrieve snapshots (version history) for a flow.
    
    Each snapshot captures the full environment configuration at a point in time.
    Useful for comparing changes and rollback decisions.
    """
    service = FlowService(db)
    snapshots = await service.get_snapshots(flow_id, limit=limit)
    
    if not snapshots and not await service.get_flow(flow_id):
        raise HTTPException(status_code=404, detail="Flow not found")
    
    return [SnapshotResponse(**s) for s in snapshots]


@router.get("/{flow_id}/snapshots/{snapshot_id}", response_model=SnapshotResponse)
async def get_snapshot(
    flow_id: str,
    snapshot_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """Retrieve a specific snapshot."""
    service = FlowService(db)
    snapshot = await service.get_snapshot(snapshot_id)
    
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    
    if snapshot["flow_id"] != flow_id:
        raise HTTPException(status_code=403, detail="Snapshot does not belong to this flow")
    
    return SnapshotResponse(**snapshot)


@router.post("/{flow_id}/rollback/{snapshot_id}")
async def rollback_to_snapshot(
    flow_id: str,
    snapshot_id: str,
    current_user: CurrentUser = Depends(require_roles("admin", "devops")),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Rollback environment values to a previous snapshot.
    
    This operation:
    1. Reads current state from Azure webapp/function app and saves it
    2. Restores ALL environments to values from the specified snapshot
    3. Creates post-rollback snapshot
    4. Logs the action for audit
    
    This ensures a complete rollback that preserves the current production state
    before reverting to a previous configuration.
    
    Query parameter:
    - **rolled_back_by**: Username performing the rollback
    """
    try:
        service = FlowService(db)
        flow = await service.rollback_to_snapshot(
            flow_id,
            snapshot_id,
            current_user.username
        )
        return FlowResponse(**flow)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error rolling back: {str(e)}")


@router.post("/{flow_id}/archive")
async def archive_flow(
    flow_id: str,
    current_user: CurrentUser = Depends(require_roles("admin")),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Archive a flow (soft delete).
    
    Archived flows are excluded from default list queries but remain in the system
    for audit and historical purposes.
    
    Query parameter:
    - **archived_by**: Username archiving the flow
    """
    try:
        service = FlowService(db)
        flow = await service.archive_flow(flow_id, current_user.username)
        return FlowResponse(**flow)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error archiving flow: {str(e)}")


@router.post("/{flow_id}/apply", response_model=ApplyResultResponse)
async def apply_changes(
    flow_id: str,
    request: ApplyRequestPayload,
    current_user: CurrentUser = Depends(require_roles("admin", "devops", "tester")),
    db: AsyncIOMotorDatabase = Depends(get_db)
):
    """
    Apply environment variables to Azure WebApp or Function App using Client Credentials.
    
    This endpoint applies the current configuration to Azure resources.
    
    Requirements:
    - Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID in .env
    - Service principal must have permission to update app settings
    
    Process:
    1. Retrieve flow configuration
    2. Authenticate to Azure using client credentials
    3. Update each specified environment
    4. Log results in audit trail
    
    Example request:
    ```json
    {
        "flow_id": "507f1f77bcf86cd799439011",
        "environments": ["stage", "preprod"],
        "approved_by": "admin@company.com",
        "approval_reason": "Production migration - phase 1"
    }
    ```
    """
    try:
        service = FlowService(db)
        flow = await service.get_flow(flow_id)
        
        if not flow:
            raise HTTPException(status_code=404, detail="Flow not found")
        
        # Apply to Azure using client credentials
        result = await service.apply_to_azure(
            flow_id=flow_id,
            environments_to_apply=request.environments,
            approved_by=current_user.username
        )
        
        return ApplyResultResponse(
            flow_id=result["flow_id"],
            status=result["status"],
            message=result["message"],
            applied_at=datetime.fromisoformat(result["applied_at"]),
            applied_envs=result["applied_envs"],
            failed_envs=result["failed_envs"]
        )
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error applying changes: {str(e)}"
        )


@router.post("/azure/validate")
async def validate_azure_credentials(_: CurrentUser = Depends(get_current_user)):
    """
    Validate Azure client credentials.
    
    This endpoint checks if the configured Azure credentials (client ID, secret, tenant ID)
    are valid and can authenticate to Azure.
    
    Useful for testing before deploying or debugging authentication issues.
    
    Returns:
    ```json
    {
        "valid": true,
        "message": "Azure credentials validated successfully for tenant xxx"
    }
    ```
    
    Or on failure:
    ```json
    {
        "valid": false,
        "message": "Azure credentials not configured (missing client_id, client_secret, or tenant_id)"
    }
    ```
    """
    try:
        azure_svc = get_azure_service()
        valid, message = await azure_svc.validate_credentials()
        
        return {
            "valid": valid,
            "message": message
        }
    except Exception as e:
        return {
            "valid": False,
            "message": f"Validation failed: {str(e)}"
        }
