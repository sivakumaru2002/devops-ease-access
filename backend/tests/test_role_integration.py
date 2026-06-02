from __future__ import annotations

from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


async def login(client: AsyncClient, email_or_username: str, password: str) -> dict:
    response = await client.post(
        "/api/auth/login",
        json={"email_or_username": email_or_username, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()


def build_flow_payload(name: str) -> dict:
    return {
        "flow_name": name,
        "repo_url": "https://example.dev.azure.com/org/project/_git/repo",
        "resource_type": "webapp",
        "environments": [
            {"name": "stage", "values": [{"key": "API_URL", "value": "https://stage.example"}]},
            {"name": "prod", "values": [{"key": "API_URL", "value": "https://prod.example"}]},
        ],
        "tags": {"release_name": "release-check", "release_id": str(uuid4())},
    }


def build_template_payload(name: str) -> dict:
    return {
        "project": f"project-{name}",
        "repo": f"repo-{name}",
        "repo_url": "https://example.dev.azure.com/org/project/_git/repo",
        "resource_type": "webapp",
        "environments": [{"name": "stage"}, {"name": "prod"}],
    }


@pytest.mark.anyio
async def test_bootstrap_logins_expose_roles() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin = await login(client, "admin@gmail.com", "admin")
        devops = await login(client, "devops", "devops123")
        tester = await login(client, "tester", "tester123")

    assert admin["role"] == "admin"
    assert admin["is_admin"] is True
    assert devops["role"] == "devops"
    assert devops["is_admin"] is False
    assert tester["role"] == "tester"
    assert tester["approved"] is True


@pytest.mark.anyio
async def test_admin_can_approve_user_with_devops_role() -> None:
    unique = uuid4().hex[:8]
    login_secret = f"secret-{unique}"
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        register = await client.post(
            "/api/auth/register",
            json={
                "email": f"role-{unique}@example.com",
                "username": f"role-{unique}",
                "password": login_secret,
            },
        )
        assert register.status_code == 200, register.text
        user_id = register.json()["user"]["id"]

        admin = await login(client, "admin@gmail.com", "admin")
        approve = await client.post(
            f"/api/admin/users/{user_id}/approve",
            params={"auth_token": admin["auth_token"], "role": "devops"},
        )
        assert approve.status_code == 200, approve.text
        assert approve.json()["user"]["role"] == "devops"

        approved_user = await login(client, f"role-{unique}", login_secret)

    assert approved_user["role"] == "devops"
    assert approved_user["approved"] is True
    assert approved_user["is_admin"] is False


@pytest.mark.anyio
async def test_env_approval_roles_do_not_break_dashboard_access() -> None:
    suffix = uuid4().hex[:8]
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin = await login(client, "admin@gmail.com", "admin")
        devops = await login(client, "devops", "devops123")
        tester = await login(client, "tester", "tester123")

        dashboard = await client.post(
            "/api/dashboards",
            params={"auth_token": admin["auth_token"]},
            json={"name": f"Role Dashboard {suffix}", "description": "regression check"},
        )
        assert dashboard.status_code == 200, dashboard.text

        dashboard_list = await client.get("/api/dashboards", params={"auth_token": tester["auth_token"]})
        assert dashboard_list.status_code == 200, dashboard_list.text

        tester_create_flow = await client.post(
            "/api/env-approval/flows",
            params={"auth_token": tester["auth_token"]},
            json=build_flow_payload(f"tester-{suffix}"),
        )
        assert tester_create_flow.status_code == 403, tester_create_flow.text

        devops_create_flow = await client.post(
            "/api/env-approval/flows",
            params={"auth_token": devops["auth_token"]},
            json=build_flow_payload(f"devops-{suffix}"),
        )
        assert devops_create_flow.status_code == 200, devops_create_flow.text
        flow_id = devops_create_flow.json()["id"]

        devops_save_template = await client.post(
            "/api/env-approval/templates",
            params={"auth_token": devops["auth_token"]},
            json=build_template_payload(f"devops-{suffix}"),
        )
        assert devops_save_template.status_code == 200, devops_save_template.text

        admin_save_template = await client.post(
            "/api/env-approval/templates",
            params={"auth_token": admin["auth_token"]},
            json=build_template_payload(f"admin-{suffix}"),
        )
        assert admin_save_template.status_code == 200, admin_save_template.text

        tester_apply = await client.post(
            f"/api/env-approval/flows/{flow_id}/apply",
            params={"auth_token": tester["auth_token"]},
            json={"flow_id": flow_id, "approved_by": tester["username"]},
        )
        assert tester_apply.status_code != 403, tester_apply.text


@pytest.mark.anyio
async def test_admin_and_devops_can_update_existing_env_template() -> None:
    suffix = uuid4().hex[:8]
    transport = ASGITransport(app=app)
    project = f"project-shared-{suffix}"
    repo = f"repo-shared-{suffix}"

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        admin = await login(client, "admin@gmail.com", "admin")
        devops = await login(client, "devops", "devops123")

        create_response = await client.post(
            "/api/env-approval/templates",
            params={"auth_token": admin["auth_token"]},
            json={
                **build_template_payload(suffix),
                "project": project,
                "repo": repo,
                "repo_url": "https://example.dev.azure.com/org/project/_git/repo-admin",
                "environments": [
                    {"name": "stage", "resource_name": "admin-stage"},
                    {"name": "prod", "resource_name": "admin-prod"},
                ],
            },
        )
        assert create_response.status_code == 200, create_response.text
        assert create_response.json()["updated_by"] == admin["username"]

        devops_update = await client.post(
            "/api/env-approval/templates",
            params={"auth_token": devops["auth_token"]},
            json={
                **build_template_payload(suffix),
                "project": project,
                "repo": repo,
                "repo_url": "https://example.dev.azure.com/org/project/_git/repo-devops",
                "environments": [
                    {"name": "stage", "resource_name": "devops-stage"},
                    {"name": "prod", "resource_name": "devops-prod"},
                ],
            },
        )
        assert devops_update.status_code == 200, devops_update.text
        assert devops_update.json()["updated_by"] == devops["username"]
        assert devops_update.json()["repo_url"] == "https://example.dev.azure.com/org/project/_git/repo-devops"
        assert devops_update.json()["environments"][0]["resource_name"] == "devops-stage"

        admin_update = await client.post(
            "/api/env-approval/templates",
            params={"auth_token": admin["auth_token"]},
            json={
                **build_template_payload(suffix),
                "project": project,
                "repo": repo,
                "repo_url": "https://example.dev.azure.com/org/project/_git/repo-admin-final",
                "environments": [
                    {"name": "stage", "resource_name": "admin-final-stage"},
                    {"name": "prod", "resource_name": "admin-final-prod"},
                ],
            },
        )
        assert admin_update.status_code == 200, admin_update.text
        assert admin_update.json()["updated_by"] == admin["username"]
        assert admin_update.json()["repo_url"] == "https://example.dev.azure.com/org/project/_git/repo-admin-final"
        assert admin_update.json()["environments"][0]["resource_name"] == "admin-final-stage"
