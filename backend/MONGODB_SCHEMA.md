# MongoDB Schema

## Collections Overview

### 1. `flows` - Live Configuration

Stores the current state of each environment's key-value pairs.

**Example Document**:
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439011"),
  "flow_name": "MyApp Staging Flow",
  "repo_url": "https://dev.azure.com/org/project/_git/myapp",
  "resource_type": "webapp",
  "resource_name": "myapp-staging-web",
  "resource_group": "myapp-rg",
  "environments": [
    {
      "name": "stage",
      "values": [
        {"key": "DB_CONNECTION", "value": "stage-db-conn-string"},
        {"key": "LOG_LEVEL", "value": "INFO"},
        {"key": "API_KEY", "value": "stage-api-key"}
      ]
    },
    {
      "name": "preprod",
      "values": [
        {"key": "DB_CONNECTION", "value": "preprod-db-conn-string"},
        {"key": "LOG_LEVEL", "value": "WARNING"},
        {"key": "API_KEY", "value": "preprod-api-key"}
      ]
    },
    {
      "name": "prod",
      "values": [
        {"key": "DB_CONNECTION", "value": "prod-db-conn-string"},
        {"key": "LOG_LEVEL", "value": "ERROR"},
        {"key": "API_KEY", "value": "prod-api-key"}
      ]
    }
  ],
  "tags": {
    "release_name": "Release-2025-03-17-001",
    "release_id": "12345"
  },
  "created_by": "john.doe@company.com",
  "created_at": ISODate("2025-03-17T10:30:00Z"),
  "updated_at": ISODate("2025-03-17T10:40:00Z"),
  "updated_by": "jane.smith@company.com",
  "status": "active"
}
```

**Validation Rules**:
- All environments must have identical key sets
- Key names must be non-empty strings
- Values can be any string
- `release_id` is mandatory
- `status` is either "active" or "archived"

**Indices**:
```javascript
db.flows.createIndex({ "repo_url": 1 })
db.flows.createIndex({ "resource_name": 1 })
db.flows.createIndex({ "created_at": -1 })
db.flows.createIndex({ "tags.release_id": 1 })
```

---

### 2. `snapshots` - Version History

Captures full configuration state at specific points in time (pre/post each change).

**Example Document**:
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439012"),
  "flow_id": ObjectId("507f1f77bcf86cd799439011"),
  "snapshot_type": "pre_change",
  "environments": [
    {
      "name": "stage",
      "values": [
        {"key": "DB_CONNECTION", "value": "old-stage-db"},
        {"key": "LOG_LEVEL", "value": "DEBUG"}
      ]
    },
    {
      "name": "preprod",
      "values": [
        {"key": "DB_CONNECTION", "value": "old-preprod-db"},
        {"key": "LOG_LEVEL", "value": "INFO"}
      ]
    }
  ],
  "created_at": ISODate("2025-03-17T10:35:00Z"),
  "created_by": "john.doe@company.com",
  "change_reason": "Updated DB_CONNECTION credential rotation",
  "related_change_id": ObjectId("507f1f77bcf86cd799439013")
}
```

**Fields**:
- `snapshot_type`: "pre_change" (before update) or "post_change" (after update)
- `change_reason`: Human-readable reason for the snapshot
- `related_change_id`: Links to associated change request if applicable

**Query Examples**:
```javascript
// Get all snapshots for a flow (most recent first)
db.snapshots.find({ "flow_id": ObjectId("507f1f77bcf86cd799439011") })
  .sort({ "created_at": -1 })
  .limit(20)

// Find pre-change snapshot before rollback
db.snapshots.findOne({
  "flow_id": ObjectId("507f1f77bcf86cd799439011"),
  "snapshot_type": "pre_change",
  "created_at": { "$lt": ISODate("2025-03-17T10:40:00Z") }
}).sort({ "created_at": -1 })
```

**Indices**:
```javascript
db.snapshots.createIndex({ "flow_id": 1 })
db.snapshots.createIndex({ "created_at": -1 })
```

---

### 3. `audit_logs` - Change Tracking

Immutable log of all actions performed on flows.

**Example Document**:
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439014"),
  "flow_id": ObjectId("507f1f77bcf86cd799439011"),
  "action": "env_value_updated",
  "performed_by": "john.doe@company.com",
  "performed_at": ISODate("2025-03-17T10:35:00Z"),
  "details": {
    "key": "DB_CONNECTION",
    "environments": ["stage", "preprod", "prod"]
  },
  "old_value": "old-value-hash",
  "new_value": "new-value-hash",
  "environment": "prod"
}
```

**Action Types**:
- `flow_created`: New flow initialized
- `env_value_updated`: Key value changed
- `flow_applied`: Applied to Azure resource
- `flow_rolled_back`: Reverted to previous state
- `flow_archived`: Flow archived

**Query Examples**:
```javascript
// Get all changes to a flow
db.audit_logs.find({ "flow_id": ObjectId("507f1f77bcf86cd799439011") })
  .sort({ "performed_at": -1 })

// Find who changed a key
db.audit_logs.find({
  "flow_id": ObjectId("507f1f77bcf86cd799439011"),
  "action": "env_value_updated",
  "details.key": "DB_CONNECTION"
})

// Audit trail for user
db.audit_logs.find({ "performed_by": "john.doe@company.com" })
  .sort({ "performed_at": -1 })
```

**Indices**:
```javascript
db.audit_logs.createIndex({ "flow_id": 1 })
db.audit_logs.createIndex({ "performed_at": -1 })
db.audit_logs.createIndex({ "performed_by": 1 })
```

---

### 4. `change_requests` - Pending Approvals (Future)

Stores pending change requests awaiting approval.

**Example Document**:
```json
{
  "_id": ObjectId("507f1f77bcf86cd799439015"),
  "flow_id": ObjectId("507f1f77bcf86cd799439011"),
  "requested_by": "john.doe@company.com",
  "requested_at": ISODate("2025-03-17T10:30:00Z"),
  "change_description": "Update production database credentials for March migration",
  "proposed_values": {
    "DB_CONNECTION": {
      "stage": "new-stage-db",
      "preprod": "new-preprod-db",
      "prod": "new-prod-db"
    }
  },
  "status": "pending",
  "approved_by": null,
  "approved_at": null,
  "approval_reason": null,
  "applied_at": null
}
```

**Status Values**:
- `pending`: Awaiting approval
- `approved`: Approved but not yet applied
- `rejected`: Approval denied
- `applied`: Applied to Azure

**Indices**:
```javascript
db.change_requests.createIndex({ "flow_id": 1 })
db.change_requests.createIndex({ "status": 1 })
db.change_requests.createIndex({ "requested_at": -1 })
```

---

## Key Consistency Rules

All documents in `flows.environments[]` must have:
1. Same `name` values across all environments
2. Same `key` names within each environment's values array
3. Non-empty `value` fields

**Validation Example**:
```python
# This is INVALID (key mismatch):
{
  "environments": [
    {
      "name": "stage",
      "values": [
        {"key": "DB_CONNECTION", "value": "..."},
        {"key": "LOG_LEVEL", "value": "..."}
      ]
    },
    {
      "name": "prod",
      "values": [
        {"key": "DB_CONNECTION", "value": "..."}
        // Missing LOG_LEVEL!
      ]
    }
  ]
}

# This is VALID (same keys, different values):
{
  "environments": [
    {
      "name": "stage",
      "values": [
        {"key": "DB_CONNECTION", "value": "stage-db"},
        {"key": "LOG_LEVEL", "value": "DEBUG"}
      ]
    },
    {
      "name": "prod",
      "values": [
        {"key": "DB_CONNECTION", "value": "prod-db"},
        {"key": "LOG_LEVEL", "value": "ERROR"}
      ]
    }
  ]
}
```

## Backup Strategy

For production:
1. **Daily snapshots** of MongoDB to Azure Blob Storage
2. **Point-in-time recovery** enabled (30 days)
3. **Immutable audit_logs** stored separately
4. **Cross-region replication** for disaster recovery
