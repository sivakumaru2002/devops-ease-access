import httpx
from .config import settings


async def summarize_failures(failure_messages: list[str]) -> str | None:
    if not failure_messages:
        return None
    if not (settings.azure_openai_endpoint and settings.azure_openai_api_key and settings.azure_openai_deployment):
        return None

    prompt = (
        "Summarize these Azure DevOps pipeline failures, identify likely root causes, "
        "and suggest concise remediations:\n\n" + "\n".join(f"- {m}" for m in failure_messages)
    )
    url = (
        f"{settings.azure_openai_endpoint}/openai/deployments/{settings.azure_openai_deployment}"
        f"/chat/completions?api-version={settings.azure_openai_api_version}"
    )
    headers = {"api-key": settings.azure_openai_api_key, "Content-Type": "application/json"}
    body = {
        "messages": [
            {"role": "system", "content": "You are an expert DevOps SRE assistant."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, headers=headers, json=body)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]
