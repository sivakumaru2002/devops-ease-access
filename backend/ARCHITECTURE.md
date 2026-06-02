# Architecture Overview

## System Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Web/CLI/API)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│         FastAPI Backend (Port 8000)                          │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐  │
│  │   Routes    │ │  Services    │ │  Request Validation  │  │
│  │  /flows     │ │ FlowService  │ │  (Pydantic Models)   │  │
│  └─────────────┘ └──────────────┘ └──────────────────────┘  │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│            MongoDB (NoSQL Database)                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │   flows      │ │  snapshots   │ │  audit_logs          │ │
│  │ (Live Config)│ │ (Versioning) │ │  (Tracking Changes)  │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│            Azure Integration (Future)                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ Azure SDK    │ │ REST API     │ │  Managed Identity    │ │
│  │ (WebApp)     │ │ (ARM)        │ │  (Auth)              │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

## Key Design Patterns

### 1. Request Validation (Pydantic)
- Strict schema validation at entry point
- Key consistency enforcement across environments
- Type checking and default values

### 2. Service Layer
- Business logic separation from routes
- MongoDB operations isolated in FlowService
- Atomic snapshots for every change

### 3. Audit & Versioning
- Pre/post-change snapshots before every update
- Complete audit log of who did what and when
- One-click rollback to any previous state

### 4. Release Tagging
- Mandatory release_name and release_id
- Traces changes back to Azure DevOps releases
- Enable approval workflows tied to releases

## Data Flow Example

```
User requests to update DB_CONNECTION in stage, preprod, prod
        │
        ▼
Validation: Key exists in all 3 environments ✓
        │
        ▼
Create Pre-Change Snapshot (backup current values)
        │
        ▼
Update Values in MongoDB flows.environments[]
        │
        ▼
Create Post-Change Snapshot
        │
        ▼
Log Audit Entry: action=env_value_updated
        │
        ▼
Return Updated Flow + Snapshots
        │
        ▼
User approves and calls /apply endpoint
        │
        ▼
Connect to Azure Resource Manager
        │
        ▼
Apply settings to WebApp/Function App
        │
        ▼
Log Success/Failure in Audit
```

## Security Considerations

1. **Authentication**: Currently no auth (add Entra ID)
2. **Authorization**: RBAC per environment (prod requires approval)
3. **Secrets**: Use Azure Key Vault for sensitive values
4. **Audit**: All changes logged and immutable
5. **Managed Identity**: For Azure API calls from service
