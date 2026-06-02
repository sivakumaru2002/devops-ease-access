from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth import CurrentUser, get_current_user, require_roles
from app.db.mongodb import get_db
from app.models.schemas import FlowTemplateResponse, SaveProjectRepoTemplateRequest
from app.services.flow_service import FlowService

router = APIRouter(prefix="/api/v1/templates", tags=["Templates"])


@router.get("/", response_model=list[FlowTemplateResponse])
async def list_templates(
    _: CurrentUser = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """List all saved templates."""
    try:
        service = FlowService(db)
        items = await service.list_templates()
        return [FlowTemplateResponse(**item) for item in items]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing templates: {str(e)}")


@router.post("/", response_model=FlowTemplateResponse, status_code=status.HTTP_201_CREATED)
async def save_template(
    request: SaveProjectRepoTemplateRequest,
    current_user: CurrentUser = Depends(require_roles("admin")),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Create or update a template by project/repo."""
    try:
        request = request.model_copy(update={"saved_by": current_user.username})
        service = FlowService(db)
        saved = await service.save_template(request)
        return FlowTemplateResponse(**saved)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving template: {str(e)}")
