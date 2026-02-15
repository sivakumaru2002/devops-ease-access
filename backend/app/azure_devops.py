import base64
from collections import Counter
from datetime import datetime
import httpx


class AzureDevOpsClient:
    def __init__(self, organization: str, pat: str):
        self.organization = organization
        token = base64.b64encode(f":{pat}".encode("utf-8")).decode("utf-8")
        self.headers = {"Authorization": f"Basic {token}"}
        self.base_url = f"https://dev.azure.com/{organization}"

    async def _get(self, path: str, params: dict | None = None) -> dict:
        url = f"{self.base_url}/{path}"
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            return response.json()

    async def list_projects(self) -> list[dict]:
        data = await self._get("_apis/projects", {"api-version": "7.1-preview.4"})
        return data.get("value", [])

    async def list_pipelines(self, project: str) -> list[dict]:
        data = await self._get(f"{project}/_apis/pipelines", {"api-version": "7.1-preview.1"})
        return data.get("value", [])

    async def list_pipeline_runs(self, project: str, pipeline_id: int) -> list[dict]:
        data = await self._get(
            f"{project}/_apis/pipelines/{pipeline_id}/runs",
            {"api-version": "7.1-preview.1", "$top": 50},
        )
        return data.get("value", [])

    async def list_builds(self, project: str) -> list[dict]:
        data = await self._get(
            f"{project}/_apis/build/builds",
            {"api-version": "7.1", "$top": 100, "queryOrder": "queueTimeDescending"},
        )
        return data.get("value", [])

    async def timeline(self, project: str, build_id: int) -> dict:
        return await self._get(f"{project}/_apis/build/builds/{build_id}/timeline", {"api-version": "7.1"})

    @staticmethod
    def summarize_build_trends(builds: list[dict]) -> dict:
        success = sum(1 for b in builds if b.get("result") == "succeeded")
        failed = sum(1 for b in builds if b.get("result") == "failed")
        by_day: Counter[str] = Counter()
        for build in builds:
            queue_time = build.get("queueTime")
            if queue_time:
                by_day[queue_time[:10]] += 1
        return {
            "total_runs": len(builds),
            "success_count": success,
            "failure_count": failed,
            "success_rate": round((success / len(builds) * 100), 2) if builds else 0,
            "build_trend": dict(sorted(by_day.items())),
        }
