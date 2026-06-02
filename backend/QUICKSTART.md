# Quick Start Guide

## Prerequisites

- Python 3.9+
- MongoDB 5.0+ (local or cloud)
- pip or poetry

## Setup

### 1. Clone & Navigate
```bash
cd backend
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

Or with poetry:
```bash
poetry install
```

### 3. Configure Environment
Copy the example and edit:
```bash
cp .env.example .env
```

Edit `.env` with your MongoDB connection string and Azure settings:
```
MONGODB_URL=mongodb://localhost:27017
MONGODB_DATABASE=env_approval_db
DEBUG=True
AZURE_SUBSCRIPTION_ID=your-sub-id
AZURE_TENANT_ID=your-tenant-id
```

### 4. Start MongoDB (if local)
```bash
# macOS/Linux
mongod --dbpath ~/data/db

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### 5. Run the Server
```bash
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or using the entry point:
```bash
python app/main.py
```

Server will start at: `http://localhost:8000`

### 6. Access API Documentation
Open browser: `http://localhost:8000/docs`

Swagger UI with interactive testing is available at `/docs`

---

## First Steps

### 1. Create a Flow
```bash
curl -X POST "http://localhost:8000/api/v1/flows" \
  -H "Content-Type: application/json" \
  -d '{
    "flow_name": "Test App",
    "repo_url": "https://dev.azure.com/org/project/_git/testapp",
    "resource_type": "webapp",
    "resource_name": "testapp-web",
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
      "release_id": "100"
    },
    "created_by": "user@company.com"
  }'
```

Save the returned `id` for next steps.

### 2. Update a Value
```bash
curl -X PATCH "http://localhost:8000/api/v1/flows/{flow_id}/values" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "DB_CONNECTION",
    "values": {
      "stage": "new-stage-db",
      "preprod": "new-preprod-db",
      "prod": "new-prod-db"
    },
    "updated_by": "user@company.com"
  }'
```

### 3. View Snapshot History
```bash
curl -X GET "http://localhost:8000/api/v1/flows/{flow_id}/snapshots" \
  -H "Content-Type: application/json"
```

### 4. Rollback (if needed)
```bash
curl -X POST "http://localhost:8000/api/v1/flows/{flow_id}/rollback/{snapshot_id}?rolled_back_by=user@company.com" \
  -H "Content-Type: application/json"
```

---

## Project Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app & lifespan
│   ├── config.py            # Settings from env vars
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py       # Pydantic request/response models
│   ├── routes/
│   │   ├── __init__.py
│   │   └── flows.py         # API endpoints
│   ├── services/
│   │   ├── __init__.py
│   │   └── flow_service.py  # Business logic
│   ├── db/
│   │   ├── __init__.py
│   │   ├── mongodb.py       # Connection & setup
│   │   └── mongo_schemas.py # MongoDB validation schema
├── requirements.txt         # Python dependencies
├── .env.example            # Environment variables template
├── API.md                  # API documentation
├── ARCHITECTURE.md         # System design
├── MONGODB_SCHEMA.md       # Database schema reference
└── QUICKSTART.md           # This file
```

---

## Testing Endpoints

### Using Swagger UI
1. Navigate to `http://localhost:8000/docs`
2. Click on each endpoint
3. Click "Try it out"
4. Edit parameters and click "Execute"

### Using Python Requests
```python
import requests
import json

BASE_URL = "http://localhost:8000"

# Create flow
response = requests.post(
    f"{BASE_URL}/api/v1/flows",
    json={
        "flow_name": "Test Flow",
        "repo_url": "https://...",
        # ... other fields
    }
)
flow = response.json()
flow_id = flow["id"]

# Update value
response = requests.patch(
    f"{BASE_URL}/api/v1/flows/{flow_id}/values",
    json={
        "key": "DB_CONNECTION",
        "values": {
            "stage": "new-val",
            "preprod": "new-val",
            "prod": "new-val"
        },
        "updated_by": "user@company.com"
    }
)
print(response.json())
```

---

## Common Issues

### MongoDB Connection Failed
- Ensure MongoDB is running: `mongo --version` or `docker ps`
- Check `MONGODB_URL` in `.env`
- Default local URL: `mongodb://localhost:27017`

### Port 8000 Already in Use
```bash
# Kill process using port 8000
lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### ModuleNotFoundError
- Ensure you're in the `backend` directory
- Run `pip install -r requirements.txt` again
- Check Python version: `python --version` (should be 3.9+)

### Schema Validation Error
- Ensure all environments have **identical keys**
- Check JSON syntax in request body
- Review error message in response

---

## Next Steps

1. **Add Authentication**: Integrate Entra ID with FastAPI
2. **Implement Azure Integration**: Use Azure SDK to sync with WebApp/Function App
3. **Add Approval Workflow**: Create change_requests collection and approval API
4. **Build UI**: React frontend for flow creation and management
5. **Add Notifications**: Teams/Slack ChatOps for approvals
6. **Deploy**: Container with Docker → Azure Container Registry → Azure Container Instances

---

## Documentation Files

- [API.md](./API.md) - Detailed API endpoint reference
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and data flow
- [MONGODB_SCHEMA.md](./MONGODB_SCHEMA.md) - Database collections and validation
