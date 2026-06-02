# API Reference

## Overview

Base URL: `http://localhost:8000`

All endpoints require:
- Method signatures shown below
- `Content-Type: application/json` for requests
- Response: JSON or error

## Health & Status

### GET `/health`
Health check endpoint.

**Response (200)**:
```json
{
  "status": "healthy",
  "service": "Env Approval Flow",
  "version": "1.0.0"
}
```

---

## Azure Diagnostics

### POST `/azure/validate`
Validate Azure client credentials configuration.

**No request body required.**

**Response (200) - Valid Credentials**:
```json
{
  "valid": true,
  "message": "Azure credentials validated successfully for tenant xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**Response (200) - Invalid Credentials**:
```json
{
  "valid": false,
  "message": "Azure credentials not configured (missing client_id, client_secret, or tenant_id)"
}
```

**Usage**: Test before deploying to ensure credentials are correct.

---

## Flows

### POST `/api/v1/flows`
Create a new flow.

**Request Body**:
```json
{
  "flow_name": "MyApp Staging Flow",
  "repo_url": "https://dev.azure.com/org/project/_git/myapp",
  "resource_type": "webapp",
  "resource_name": "myapp-staging-web",
  "resource_group": "myapp-rg",
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
    "release_name": "Release-2025-03-17-001",
    "release_id": "12345"
  },
  "created_by": "john.doe@company.com"
}
```

**Response (201)**:
```json
{
  "id": "507f1f77bcf86cd799439011",
  "flow_name": "MyApp Staging Flow",
  "repo_url": "https://dev.azure.com/org/project/_git/myapp",
  "resource_type": "webapp",
  "resource_name": "myapp-staging-web",
  "resource_group": "myapp-rg",
  "environments": [...],
  "tags": {...},
  "created_by": "john.doe@company.com",
  "created_at": "2025-03-17T10:30:00",
  "updated_at": "2025-03-17T10:30:00",
  "status": "active"
}
```

**Errors**:
- `400`: Key mismatch across environments
- `500`: Server error

---

### GET `/api/v1/flows`
List flows with pagination.

**Query Parameters**:
- `skip` (integer, default=0): Number of records to skip
- `limit` (integer, default=50, max=100): Records per page
- `status` (string, default="active"): "active" or "archived"

**Response (200)**:
```json
[
  {
    "id": "507f1f77bcf86cd799439011",
    "flow_name": "MyApp Staging Flow",
    ...
  },
  ...
]
```

---

### GET `/api/v1/flows/{flow_id}`
Retrieve a single flow.

**Response (200)**:
```json
{
  "id": "507f1f77bcf86cd799439011",
  "flow_name": "MyApp Staging Flow",
  ...
}
```

**Errors**:
- `404`: Flow not found

---

### PATCH `/api/v1/flows/{flow_id}/values`
Update environment values for a key.

**Request Body**:
```json
{
  "key": "DB_CONNECTION",
  "values": {
    "stage": "new-stage-db",
    "preprod": "new-preprod-db",
    "prod": "new-prod-db"
  },
  "updated_by": "john.doe@company.com"
}
```

**Response (200)**:
Updated flow object (same as GET).

**Important Rules**:
- The key must already exist in all requested environments
- All environments in `values` dict must exist in the flow
- This creates pre/post change snapshots automatically
- Changes are tracked in audit logs

**Errors**:
- `400`: Key not found or environment mismatch
- `404`: Flow not found
- `500`: Server error

---

### GET `/api/v1/flows/{flow_id}/snapshots`
List snapshots (version history) for a flow.

**Query Parameters**:
- `limit` (integer, default=20): Max snapshots to return

**Response (200)**:
```json
[
  {
    "id": "507f1f77bcf86cd799439012",
    "flow_id": "507f1f77bcf86cd799439011",
    "snapshot_type": "post_change",
    "environments": [...],
    "created_at": "2025-03-17T10:35:00",
    "created_by": "john.doe@company.com",
    "change_reason": "Updated DB_CONNECTION in all envs"
  },
  ...
]
```

---

### GET `/api/v1/flows/{flow_id}/snapshots/{snapshot_id}`
Retrieve a specific snapshot.

**Response (200)**:
```json
{
  "id": "507f1f77bcf86cd799439012",
  "flow_id": "507f1f77bcf86cd799439011",
  ...
}
```

**Errors**:
- `404`: Snapshot not found
- `403`: Snapshot doesn't belong to this flow

---

### POST `/api/v1/flows/{flow_id}/rollback/{snapshot_id}`
Rollback to a previous snapshot.

**Query Parameters**:
- `rolled_back_by` (string): Username performing rollback

**Response (200)**:
Updated flow with restored values.

**Process**:
1. Creates pre-rollback snapshot
2. Restores environment values
3. Creates post-rollback snapshot
4. Logs audit entry

**Errors**:
- `400`: Invalid IDs or snapshot mismatch
- `404`: Flow or snapshot not found

---

### POST `/api/v1/flows/{flow_id}/apply`
Apply environment variables to Azure WebApp or Function App using Client Credentials.

**Request Body**:
```json
{
  "flow_id": "507f1f77bcf86cd799439011",
  "environments": ["stage", "preprod"],
  "approved_by": "admin@company.com",
  "approval_reason": "Scheduled production migration"
}
```

**Response (200) - Success**:
```json
{
  "flow_id": "507f1f77bcf86cd799439011",
  "status": "success",
  "message": "Applied to 2 environment(s)",
  "applied_at": "2025-03-17T10:40:00",
  "applied_envs": ["stage", "preprod"],
  "failed_envs": [],
  "resource_type": "webapp",
  "resource_name": "myapp-web",
  "resource_group": "myapp-rg"
}
```

**Response (200) - Partial Failure**:
```json
{
  "flow_id": "507f1f77bcf86cd799439011",
  "status": "partial",
  "message": "Applied to 1 environment(s)",
  "applied_at": "2025-03-17T10:40:00",
  "applied_envs": ["stage"],
  "failed_envs": ["preprod"],
  "error_details": {
    "preprod": "The caller is not authorized to perform action 'Microsoft.Web/sites/config/write'"
  }
}
```

**Requirements**:
- Azure credentials configured in `.env`:
  - `AZURE_CLIENT_ID`
  - `AZURE_CLIENT_SECRET`
  - `AZURE_TENANT_ID`
- Service principal must have **Contributor** role on resource group
- Resource must exist in Azure

**Process**:
1. Retrieves flow configuration
2. Authenticates to Azure using Client Secret
3. Updates each specified environment's app settings
4. Logs results in audit trail
5. Returns success/failure status

**Status Values**:
- `success`: All environments applied
- `partial`: Some environments applied, others failed
- `failed`: All environments failed

**Test Credentials**: Use `POST /azure/validate` to test credentials before applying.

**Errors**:
- `400`: Invalid flow ID or environment
- `404`: Flow not found
- `500`: Azure API error (check credentials and permissions)

---

### POST `/api/v1/flows/{flow_id}/archive`
Archive a flow (soft delete).

**Query Parameters**:
- `archived_by` (string): Username archiving the flow

**Response (200)**:
Updated flow with `status: "archived"`.

**Behavior**:
- Flow is hidden from default list queries
- Snapshots and audit logs remain accessible
- Can be unarchived by direct update if needed

**Errors**:
- `404`: Flow not found
