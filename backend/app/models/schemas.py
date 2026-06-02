from pydantic import BaseModel, Field, field_validator
from typing import Dict, List, Optional
from datetime import datetime
from enum import Enum


class ResourceType(str, Enum):
    """Supported Azure resource types."""
    WEBAPP = "webapp"
    FUNCTION_APP = "function_app"


class EnvKeyValue(BaseModel):
    """Single key-value pair for an environment."""
    key: str = Field(..., min_length=1, description="Environment variable key")
    value: str = Field(..., description="Environment variable value")
    
    class Config:
        json_schema_extra = {
            "example": {
                "key": "DB_CONNECTION_STRING",
                "value": "Server=localhost;Database=mydb"
            }
        }


class EnvironmentConfig(BaseModel):
    """Configuration for a single environment."""
    name: str = Field(..., min_length=1, description="Environment name")
    resource_name: Optional[str] = Field(default=None, description="Environment-specific Azure resource name")
    resource_group: Optional[str] = Field(default=None, description="Environment-specific Azure resource group")
    subscription_id: Optional[str] = Field(default=None, description="Environment-specific Azure subscription ID")
    values: List[EnvKeyValue] = Field(default_factory=list, description="Key-value pairs")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "stage",
                "values": [
                    {"key": "DB_CONNECTION_STRING", "value": "stage-db-conn"},
                    {"key": "LOG_LEVEL", "value": "DEBUG"}
                ]
            }
        }


class FlowTag(BaseModel):
    """Release metadata tags."""
    release_name: str = Field(..., min_length=1, description="Release name from Azure DevOps")
    release_id: str = Field(..., min_length=1, description="Release ID from Azure DevOps")
    
    class Config:
        json_schema_extra = {
            "example": {
                "release_name": "Release-2025-03-17",
                "release_id": "12345"
            }
        }


class CreateFlowRequest(BaseModel):
    """Request to create a new flow."""
    flow_name: str = Field(..., min_length=1, description="Human-friendly flow name")
    repo_url: str = Field(..., description="Azure DevOps repo URL")
    resource_type: ResourceType = Field(..., description="Type of Azure resource")
    resource_name: Optional[str] = Field(default=None, description="Default Azure resource name")
    resource_group: Optional[str] = Field(default=None, description="Default Azure resource group name")
    subscription_id: Optional[str] = Field(default=None, description="Default Azure subscription ID")
    environments: List[EnvironmentConfig] = Field(..., min_items=1, description="Environment configs")
    tags: FlowTag = Field(..., description="Release metadata")
    created_by: str = Field(..., description="Username of creator")
    
    @field_validator('environments')
    @classmethod
    def validate_key_consistency(cls, envs: List[EnvironmentConfig]) -> List[EnvironmentConfig]:
        """Ensure all non-empty environments have the same set of keys."""
        if not envs:
            raise ValueError("At least one environment is required")

        env_names = [env.name.strip().lower() for env in envs]
        if len(env_names) != len(set(env_names)):
            raise ValueError("Environment names must be unique")

        non_empty_envs = [env for env in envs if env.values]
        if not non_empty_envs:
            return envs

        first_keys = {v.key for v in non_empty_envs[0].values}
        for env in non_empty_envs[1:]:
            current_keys = {v.key for v in env.values}
            if current_keys != first_keys:
                missing = first_keys - current_keys
                extra = current_keys - first_keys
                msg = f"Key mismatch in {env.name}."
                if missing:
                    msg += f" Missing: {missing}."
                if extra:
                    msg += f" Extra: {extra}."
                raise ValueError(msg)
        
        return envs
    
    class Config:
        json_schema_extra = {
            "example": {
                "flow_name": "MyApp Staging Flow",
                "repo_url": "https://dev.azure.com/org/project/_git/myapp",
                "resource_type": "webapp",
                "resource_name": "myapp-staging-web",
                "resource_group": "myapp-rg",
                "subscription_id": "00000000-0000-0000-0000-000000000000",
                "environments": [
                    {
                        "name": "stage",
                        "resource_name": "myapp-stage-web",
                        "resource_group": "myapp-stage-rg",
                        "subscription_id": "11111111-1111-1111-1111-111111111111",
                        "values": [
                            {"key": "DB_CONNECTION", "value": "stage-db"},
                            {"key": "LOG_LEVEL", "value": "INFO"}
                        ]
                    },
                    {
                        "name": "preprod",
                        "resource_name": "myapp-preprod-web",
                        "resource_group": "myapp-preprod-rg",
                        "subscription_id": "22222222-2222-2222-2222-222222222222",
                        "values": [
                            {"key": "DB_CONNECTION", "value": "preprod-db"},
                            {"key": "LOG_LEVEL", "value": "WARNING"}
                        ]
                    },
                    {
                        "name": "prod",
                        "values": [
                            {"key": "DB_CONNECTION", "value": "prod-db"},
                            {"key": "LOG_LEVEL", "value": "ERROR"}
                        ]
                    }
                ],
                "tags": {
                    "release_name": "Release-2025-03-17-001",
                    "release_id": "12345"
                },
                "created_by": "john.doe@company.com"
            }
        }


class UpdateEnvValuesRequest(BaseModel):
    """Request to update environment values."""
    key: str = Field(..., description="Key to update")
    values: Dict[str, str] = Field(..., description="Environment name -> value mapping")
    updated_by: str = Field(..., description="Username of updater")
    
    @field_validator('values')
    @classmethod
    def validate_values(cls, v: Dict[str, str]) -> Dict[str, str]:
        """Ensure all requested environments have values."""
        if not v:
            raise ValueError("At least one environment value is required")
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "key": "DB_CONNECTION",
                "values": {
                    "stage": "new-stage-db-conn",
                    "preprod": "new-preprod-db-conn",
                    "prod": "new-prod-db-conn"
                },
                "updated_by": "john.doe@company.com"
            }
        }


class FlowResponse(BaseModel):
    """Response containing flow details."""
    id: str = Field(..., description="Flow ID (MongoDB ObjectId)")
    flow_name: str
    repo_url: str
    resource_type: str
    resource_name: Optional[str] = None
    resource_group: Optional[str] = None
    subscription_id: Optional[str] = None
    environments: List[EnvironmentConfig]
    tags: FlowTag
    created_by: str
    created_at: datetime
    updated_at: datetime
    status: str = Field(default="active", description="active or archived")
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439011",
                "flow_name": "MyApp Staging Flow",
                "repo_url": "https://dev.azure.com/org/project/_git/myapp",
                "resource_type": "webapp",
                "resource_name": "myapp-staging-web",
                "resource_group": "myapp-rg",
                "environments": [],
                "tags": {},
                "created_by": "john.doe@company.com",
                "created_at": "2025-03-17T10:30:00Z",
                "updated_at": "2025-03-17T10:30:00Z",
                "status": "active"
            }
        }


class SnapshotResponse(BaseModel):
    """Response containing snapshot details."""
    id: str = Field(..., description="Snapshot ID")
    flow_id: str
    snapshot_type: str = Field(description="pre_change or post_change")
    environments: List[EnvironmentConfig]
    created_at: datetime
    created_by: str
    change_reason: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "507f1f77bcf86cd799439012",
                "flow_id": "507f1f77bcf86cd799439011",
                "snapshot_type": "pre_change",
                "environments": [],
                "created_at": "2025-03-17T10:30:00Z",
                "created_by": "john.doe@company.com",
                "change_reason": "Updated DB_CONNECTION in all envs"
            }
        }


class ApplyRequestPayload(BaseModel):
    """Request to apply changes to Azure resources."""
    flow_id: str
    environments: Optional[List[str]] = None  # None = apply to all
    approved_by: str
    approval_reason: Optional[str] = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "flow_id": "507f1f77bcf86cd799439011",
                "environments": ["stage", "preprod"],
                "approved_by": "admin@company.com",
                "approval_reason": "Scheduled update"
            }
        }


class ApplyResultResponse(BaseModel):
    """Response from applying changes."""
    flow_id: str
    status: str = Field(description="success, partial, or failed")
    message: str
    applied_at: datetime
    applied_envs: List[str]
    failed_envs: List[str] = Field(default_factory=list)
    
    class Config:
        json_schema_extra = {
            "example": {
                "flow_id": "507f1f77bcf86cd799439011",
                "status": "success",
                "message": "All environments updated successfully",
                "applied_at": "2025-03-17T10:35:00Z",
                "applied_envs": ["stage", "preprod", "prod"],
                "failed_envs": []
            }
        }


class ErrorResponse(BaseModel):
    """Standard error response."""
    status_code: int
    message: str
    details: Optional[Dict] = None


class SaveFlowTemplateRequest(BaseModel):
    """Request to save or update a reusable flow template."""
    project: str = Field(..., min_length=1, description="Project name")
    repo: str = Field(..., min_length=1, description="Repository name")
    repo_url: Optional[str] = Field(default=None, description="Optional repository URL")
    environments: List[str] = Field(..., min_items=1, description="Environment names for this repo template")
    saved_by: str = Field(..., min_length=1, description="Username saving this template")

    @field_validator("environments")
    @classmethod
    def validate_template_envs(cls, envs: List[str]) -> List[str]:
        normalized = [env.strip().lower() for env in envs if env and env.strip()]
        if not normalized:
            raise ValueError("At least one environment is required")
        if len(normalized) != len(set(normalized)):
            raise ValueError("Environment names in template must be unique")
        return normalized


class FlowTemplateResponse(BaseModel):
    """Response containing template details."""
    id: str
    project: str
    repo: str
    repo_url: Optional[str] = None
    resource_type: ResourceType
    environments: List[EnvironmentConfig]
    created_at: datetime
    updated_at: datetime
    updated_by: str


class SaveTemplateEnvironmentRequest(BaseModel):
    """Environment definition inside a template."""
    name: str = Field(..., min_length=1, description="Environment name")
    resource_name: Optional[str] = Field(default=None, description="Environment resource name")
    resource_group: Optional[str] = Field(default=None, description="Environment resource group")
    subscription_id: Optional[str] = Field(default=None, description="Environment subscription id")


class SaveProjectRepoTemplateRequest(BaseModel):
    """Request to save a project->repo template with environment resources."""
    project: str = Field(..., min_length=1, description="Project name")
    repo: str = Field(..., min_length=1, description="Repository name")
    repo_url: Optional[str] = Field(default=None, description="Optional repository URL")
    resource_type: ResourceType = Field(..., description="Default resource type for this template")
    environments: List[SaveTemplateEnvironmentRequest] = Field(..., min_items=1)
    saved_by: str = Field(..., min_length=1)

    @field_validator("environments")
    @classmethod
    def validate_unique_env_names(cls, envs: List[SaveTemplateEnvironmentRequest]) -> List[SaveTemplateEnvironmentRequest]:
        names = [env.name.strip().lower() for env in envs if env.name and env.name.strip()]
        if len(names) != len(set(names)):
            raise ValueError("Environment names in template must be unique")
        return envs
