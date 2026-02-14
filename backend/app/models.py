from datetime import datetime
from pydantic import BaseModel, Field


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
    approved: bool
    is_admin: bool
    created_at: datetime
