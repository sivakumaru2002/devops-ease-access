from collections import Counter
from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .ai import summarize_failures
from .azure_devops import AzureDevOpsClient
from .cache import TTLCache
from .config import settings
from .models import ConnectRequest, ConnectResponse
from .security import decrypt_secret, encrypt_secret


app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

session_store: dict[str, dict] = {}
cache = TTLCache(settings.cache_ttl_seconds)


def _get_session(session_id: str) -> dict:
    session = session_store.get(session_id)
    if not session:
        raise HTTPException(401, "Invalid session")
    if session["expires_at"] < datetime.utcnow():
        session_store.pop(session_id, None)
        raise HTTPException(401, "Session expired")
    return session


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/api/connect", response_model=ConnectResponse)
async def connect(payload: ConnectRequest) -> ConnectResponse:
    client = AzureDevOpsClient(payload.organization, payload.pat)
    try:
        projects = await client.list_projects()
    except Exception as ex:
        raise HTTPException(status_code=401, detail=f"Authentication/connectivity failed: {ex}") from ex

    session_id = str(uuid4())
    session_store[session_id] = {
        "organization": payload.organization,
        "encrypted_pat": encrypt_secret(payload.pat),
        "expires_at": datetime.utcnow() + timedelta(minutes=settings.session_ttl_minutes),
    }
    return ConnectResponse(session_id=session_id, organization=payload.organization, project_count=len(projects))


@app.get("/api/projects")
async def projects(session_id: str) -> list[dict]:
    session = _get_session(session_id)
    client = AzureDevOpsClient(session["organization"], decrypt_secret(session["encrypted_pat"]))
    return await client.list_projects()


@app.get("/api/projects/{project}/pipelines")
async def pipelines(project: str, session_id: str) -> list[dict]:
    session = _get_session(session_id)
    client = AzureDevOpsClient(session["organization"], decrypt_secret(session["encrypted_pat"]))
    pipeline_list = await client.list_pipelines(project)

    enriched = []
    for pipe in pipeline_list:
        runs = await client.list_pipeline_runs(project, pipe["id"])
        latest = runs[0] if runs else {}
        enriched.append(
            {
                "id": pipe["id"],
                "name": pipe["name"],
                "latest_status": latest.get("state", "unknown"),
                "latest_result": latest.get("result", "unknown"),
            }
        )
    return enriched


@app.get("/api/projects/{project}/analytics")
async def analytics(project: str, session_id: str) -> dict:
    session = _get_session(session_id)
    cache_key = f"analytics:{session_id}:{project}"
    if cached := cache.get(cache_key):
        return cached

    client = AzureDevOpsClient(session["organization"], decrypt_secret(session["encrypted_pat"]))
    builds = await client.list_builds(project)
    trends = client.summarize_build_trends(builds)

    failures_by_definition: Counter[str] = Counter()
    for build in builds:
        if build.get("result") == "failed":
            definition = (build.get("definition") or {}).get("name", "Unknown")
            failures_by_definition[definition] += 1

    payload = {
        **trends,
        "failure_distribution": dict(failures_by_definition),
        "code_push_frequency": trends["build_trend"],
    }
    cache.set(cache_key, payload)
    return payload


@app.get("/api/projects/{project}/pipelines/{pipeline_id}/runs")
async def pipeline_runs(project: str, pipeline_id: int, session_id: str) -> list[dict]:
    session = _get_session(session_id)
    client = AzureDevOpsClient(session["organization"], decrypt_secret(session["encrypted_pat"]))
    return await client.list_pipeline_runs(project, pipeline_id)


@app.get("/api/projects/{project}/pipelines/{pipeline_id}/error-intelligence")
async def error_intelligence(project: str, pipeline_id: int, session_id: str, run_id: int | None = None) -> dict:
    session = _get_session(session_id)
    client = AzureDevOpsClient(session["organization"], decrypt_secret(session["encrypted_pat"]))

    runs = await client.list_pipeline_runs(project, pipeline_id)
    failed_runs = [r for r in runs if r.get("result") == "failed"]

    if run_id is not None:
        target = next((r for r in runs if r.get("id") == run_id), None)
        if not target:
            raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
        if target.get("result") != "failed":
            return {
                "pipeline_id": pipeline_id,
                "pipeline_name": target.get("pipeline", {}).get("name", str(pipeline_id)),
                "status": "All Builds Successful",
                "failure_summary": {},
                "failed_runs": [],
                "ai_summary": None,
            }
        failed_runs = [target]

    if not failed_runs:
        return {
            "pipeline_id": pipeline_id,
            "pipeline_name": runs[0].get("pipeline", {}).get("name") if runs else str(pipeline_id),
            "status": "All Builds Successful",
            "failure_summary": {},
            "failed_runs": [],
            "ai_summary": None,
        }

    collected = []
    summary = Counter()

    for run in failed_runs[:20]:
        build_id = run.get("id")
        failed_task = "Unknown Task"
        message = "No error detail available"
        task_type = "Unknown"
        log_id = None

        try:
            timeline = await client.timeline(project, build_id)
            failed_records = [r for r in timeline.get("records", []) if r.get("result") == "failed"]
            if failed_records:
                # Prefer failed task records with explicit issues; avoid stage/job wrappers
                # like "__default" whenever a concrete failed task exists.
                prioritized = sorted(
                    failed_records,
                    key=lambda r: (
                        0 if r.get("type") == "Task" else 1,
                        0 if (r.get("issues") or []) else 1,
                        0 if (r.get("errorCount") or 0) > 0 else 1,
                    ),
                )
                best = prioritized[0]

                task_obj = best.get("task") or {}
                task_name = task_obj.get("name")
                display_name = best.get("name")
                ref_name = best.get("refName")
                failed_task = display_name or task_name or ref_name or failed_task
                task_type = task_name or best.get("type") or "Unknown"
                log_id = ((best.get("log") or {}).get("id"))

                issues = best.get("issues") or []
                error_issues = [i for i in issues if i.get("type") == "error"]
                if error_issues:
                    message = error_issues[0].get("message", message)
                elif issues:
                    message = issues[0].get("message", message)
                else:
                    # Fallback to timeline metadata if issues are absent.
                    message = best.get("resultCode") or best.get("currentOperation") or display_name or message
        except Exception:
            pass

        summary[failed_task] += 1
        collected.append(
            {
                "run_id": build_id,
                "failed_task": failed_task,
                "error_message": message,
                "timestamp": run.get("createdDate"),
                "logs_summary": message[:180],
                "task_type": task_type,
                "log_id": log_id,
            }
        )

    ai_summary = await summarize_failures([f["error_message"] for f in collected])

    return {
        "pipeline_id": pipeline_id,
        "pipeline_name": failed_runs[0].get("pipeline", {}).get("name", str(pipeline_id)),
        "status": "Failures Detected",
        "failure_summary": dict(summary),
        "failed_runs": collected,
        "ai_summary": ai_summary,
    }
