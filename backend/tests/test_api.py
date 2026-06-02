"""
Test suite for Env Approval Flow API.

Run with: pytest
"""

import pytest
import json
from httpx import AsyncClient
from app.main import app
from app.db.mongodb import MongoDB
from motor.motor_asyncio import AsyncClient as MotorAsyncClient


@pytest.fixture(scope="session")
async def setup():
    """Setup test database."""
    await MongoDB.connect()
    yield
    await MongoDB.disconnect()


@pytest.mark.asyncio
async def test_health_check():
    """Test health endpoint."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_create_flow(setup):
    """Test flow creation."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        payload = {
            "flow_name": "Test Flow",
            "repo_url": "https://dev.azure.com/org/test/_git/repo",
            "resource_type": "webapp",
            "resource_name": "test-web",
            "resource_group": "test-rg",
            "environments": [
                {
                    "name": "stage",
                    "values": [
                        {"key": "DB_CONNECTION", "value": "stage-db"},
                        {"key": "LOG_LEVEL", "value": "INFO"}
                    ]
                },
                {
                    "name": "preprod",
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
                "release_name": "Release-2025-03-17",
                "release_id": "12345"
            },
            "created_by": "test@example.com"
        }
        
        response = await client.post("/api/v1/flows", json=payload)
        assert response.status_code == 201
        
        data = response.json()
        assert data["flow_name"] == "Test Flow"
        assert data["status"] == "active"
        assert len(data["environments"]) == 3
        
        return data["id"]


@pytest.mark.asyncio
async def test_key_mismatch_validation():
    """Test that mismatched keys are rejected."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        # Keys don't match across environments
        payload = {
            "flow_name": "Bad Flow",
            "repo_url": "https://dev.azure.com/org/test/_git/repo",
            "resource_type": "webapp",
            "resource_name": "test-web",
            "resource_group": "test-rg",
            "environments": [
                {
                    "name": "stage",
                    "values": [
                        {"key": "DB_CONNECTION", "value": "stage-db"},
                        {"key": "LOG_LEVEL", "value": "INFO"}
                    ]
                },
                {
                    "name": "prod",
                    "values": [
                        {"key": "DB_CONNECTION", "value": "prod-db"}
                        # Missing LOG_LEVEL!
                    ]
                }
            ],
            "tags": {
                "release_name": "Release-2025-03-17",
                "release_id": "12345"
            },
            "created_by": "test@example.com"
        }
        
        response = await client.post("/api/v1/flows", json=payload)
        assert response.status_code == 422  # Validation error


# Note: Integration tests with MongoDB require proper test database setup.
# For now, these are schema/validation tests.
# Full integration tests can be added when DB fixtures are properly configured.
