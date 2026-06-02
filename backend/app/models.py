from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


UserRole = Literal["admin", "devops", "tester"]


class ConnectRequest(BaseModel):
    organization: str = Field(..., min_length=2)
    pat: str = Field(..., min_length=5)


class ConnectResponse(BaseModel):
    session_id: str
    organization: str
    project_count: int


class PipelineSummary(BaseModel):
    id: int
    name: str
    latest_status: str
    latest_result: str


class FailedRunInsight(BaseModel):
    run_id: int
    failed_task: str
    error_message: str
    timestamp: datetime
    logs_summary: str


class ErrorIntelligence(BaseModel):
    pipeline_id: int
    pipeline_name: str
    status: str
    failure_summary: dict[str, int] = {}
    failed_runs: list[FailedRunInsight] = []
    ai_summary: str | None = None


class ResourceCreateRequest(BaseModel):
    project: str = Field(..., min_length=1)
    environment: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    url: str = Field(..., min_length=4)
    resource_type: str | None = None
    notes: str | None = None


class ResourceItem(BaseModel):
    id: str
    organization: str
    project: str
    environment: str
    name: str
    url: str
    resource_type: str | None = None
    notes: str | None = None
    created_at: datetime


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5)
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=4)


class LoginRequest(BaseModel):
    email_or_username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=4)


class AuthResponse(BaseModel):
    auth_token: str
    email: str
    username: str
    role: UserRole
    is_admin: bool
    approved: bool


class DashboardCreateRequest(BaseModel):
    name: str = Field(..., min_length=2)
    description: str | None = None


class DashboardItem(BaseModel):
    id: str
    name: str
    description: str | None = None
    created_by: str
    created_at: datetime


class PendingUserItem(BaseModel):
    id: str
    email: str
    username: str
    role: UserRole
    approved: bool
    is_admin: bool
    created_at: datetime


class DevOpsCredentialRequest(BaseModel):
    organization: str = Field(..., min_length=2)
    pat: str = Field(..., min_length=5)


class DevOpsCredentialInfo(BaseModel):
    organization: str | None = None
    has_pat: bool = False
    updated_at: datetime | None = None


class DashboardResourceCreateRequest(BaseModel):
    project: str = Field(..., min_length=1)
    environment: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    url: str = Field(..., min_length=4)
    resource_type: str | None = None
    notes: str | None = None


class DashboardResourceItem(BaseModel):
    id: str
    dashboard_id: str
    owner_email: str
    project: str
    environment: str
    name: str
    url: str
    resource_type: str | None = None
    notes: str | None = None
    created_at: datetime


class DashboardResourceUpdateRequest(BaseModel):
    project: str = Field(..., min_length=1)
    environment: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    url: str = Field(..., min_length=4)
    resource_type: str | None = None
    notes: str | None = None


class EnvApprovalKeyValue(BaseModel):
    key: str = Field(..., min_length=1)
    value: str = ""


class EnvApprovalEnvironment(BaseModel):
    name: str = Field(..., min_length=1)
    resource_name: str | None = None
    resource_group: str | None = None
    subscription_id: str | None = None
    values: list[EnvApprovalKeyValue] = Field(default_factory=list)


class EnvApprovalTags(BaseModel):
    release_name: str = Field(..., min_length=1)
    release_id: str = Field(..., min_length=1)


class EnvApprovalTemplateEnvironmentRequest(BaseModel):
    name: str = Field(..., min_length=1)
    resource_name: str | None = None
    resource_group: str | None = None
    subscription_id: str | None = None


class EnvApprovalTemplateRequest(BaseModel):
    project: str = Field(..., min_length=1)
    repo: str = Field(..., min_length=1)
    repo_url: str | None = None
    resource_type: str = Field(..., min_length=1)
    environments: list[EnvApprovalTemplateEnvironmentRequest] = Field(..., min_length=1)
    saved_by: str | None = None


class EnvApprovalTemplateItem(BaseModel):
    id: str
    project: str
    repo: str
    repo_url: str | None = None
    resource_type: str
    environments: list[EnvApprovalEnvironment]
    created_at: datetime
    updated_at: datetime
    updated_by: str


class EnvApprovalFlowCreateRequest(BaseModel):
    flow_name: str = Field(..., min_length=1)
    repo_url: str = Field(..., min_length=1)
    resource_type: str = Field(..., min_length=1)
    resource_name: str | None = None
    resource_group: str | None = None
    subscription_id: str | None = None
    environments: list[EnvApprovalEnvironment] = Field(..., min_length=1)
    tags: EnvApprovalTags
    created_by: str | None = None


class EnvApprovalFlowItem(BaseModel):
    id: str
    flow_name: str
    repo_url: str
    resource_type: str
    resource_name: str | None = None
    resource_group: str | None = None
    subscription_id: str | None = None
    environments: list[EnvApprovalEnvironment]
    tags: EnvApprovalTags
    created_by: str
    created_at: datetime
    updated_at: datetime
    status: str = "active"


class EnvApprovalUpdateValuesRequest(BaseModel):
    key: str = Field(..., min_length=1)
    values: dict[str, str] = Field(..., min_length=1)
    updated_by: str = Field(..., min_length=1)


class EnvApprovalSnapshotItem(BaseModel):
    id: str
    flow_id: str
    snapshot_type: str
    environments: list[EnvApprovalEnvironment]
    created_at: datetime
    created_by: str
    change_reason: str | None = None


class EnvApprovalApplyRequest(BaseModel):
    flow_id: str
    environments: list[str] | None = None
    approved_by: str = Field(..., min_length=1)
    approval_reason: str | None = None


class EnvApprovalApplyResult(BaseModel):
    flow_id: str
    status: str
    message: str
    applied_at: datetime
    applied_envs: list[str]
    failed_envs: list[str] = Field(default_factory=list)
