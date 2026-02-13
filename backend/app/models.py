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
