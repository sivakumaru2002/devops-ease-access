from bson import ObjectId
from typing import Dict, List, Optional
from datetime import datetime


class FlowDocument:
    """MongoDB document structure for Flow."""
    
    @staticmethod
    def schema():
        return {
            "bsonType": "object",
            "required": ["flow_name", "repo_url", "resource_type", "environments", "tags", "created_by", "created_at", "updated_at"],
            "properties": {
                "_id": {"bsonType": "objectId"},
                "flow_name": {"bsonType": "string"},
                "repo_url": {"bsonType": "string"},
                "resource_type": {"enum": ["webapp", "function_app"]},
                "resource_name": {"bsonType": ["string", "null"]},
                "resource_group": {"bsonType": ["string", "null"]},
                "subscription_id": {"bsonType": ["string", "null"]},
                "environments": {
                    "bsonType": "array",
                    "items": {
                        "bsonType": "object",
                        "required": ["name", "values"],
                        "properties": {
                            "name": {"bsonType": "string"},
                            "resource_name": {"bsonType": ["string", "null"]},
                            "resource_group": {"bsonType": ["string", "null"]},
                            "subscription_id": {"bsonType": ["string", "null"]},
                            "values": {
                                "bsonType": "array",
                                "items": {
                                    "bsonType": "object",
                                    "required": ["key", "value"],
                                    "properties": {
                                        "key": {"bsonType": "string"},
                                        "value": {"bsonType": "string"}
                                    }
                                }
                            }
                        }
                    }
                },
                "tags": {
                    "bsonType": "object",
                    "required": ["release_name", "release_id"],
                    "properties": {
                        "release_name": {"bsonType": "string"},
                        "release_id": {"bsonType": "string"}
                    }
                },
                "created_by": {"bsonType": "string"},
                "created_at": {"bsonType": "date"},
                "updated_at": {"bsonType": "date"},
                "updated_by": {"bsonType": "string"},
                "status": {"enum": ["active", "archived"]}
            }
        }


class SnapshotDocument:
    """MongoDB document structure for Snapshot (versioning)."""
    
    @staticmethod
    def schema():
        return {
            "bsonType": "object",
            "required": ["flow_id", "snapshot_type", "environments", "created_at", "created_by"],
            "properties": {
                "_id": {"bsonType": "objectId"},
                "flow_id": {"bsonType": "objectId"},
                "snapshot_type": {"enum": ["pre_change", "post_change"]},
                "environments": {
                    "bsonType": "array",
                    "items": {
                        "bsonType": "object",
                        "required": ["name", "values"],
                        "properties": {
                            "name": {"bsonType": "string"},
                            "values": {
                                "bsonType": "array",
                                "items": {
                                    "bsonType": "object",
                                    "required": ["key", "value"],
                                    "properties": {
                                        "key": {"bsonType": "string"},
                                        "value": {"bsonType": "string"}
                                    }
                                }
                            }
                        }
                    }
                },
                "created_at": {"bsonType": "date"},
                "created_by": {"bsonType": "string"},
                "change_reason": {"bsonType": "string"},
                "related_change_id": {"bsonType": "objectId"}
            }
        }


class AuditLogDocument:
    """MongoDB document structure for Audit Log."""
    
    @staticmethod
    def schema():
        return {
            "bsonType": "object",
            "required": ["flow_id", "action", "performed_by", "performed_at"],
            "properties": {
                "_id": {"bsonType": "objectId"},
                "flow_id": {"bsonType": "objectId"},
                "action": {
                    "enum": [
                        "flow_created",
                        "env_value_updated",
                        "flow_applied",
                        "flow_rolled_back",
                        "flow_archived"
                    ]
                },
                "performed_by": {"bsonType": "string"},
                "performed_at": {"bsonType": "date"},
                "details": {"bsonType": "object"},
                "old_value": {"bsonType": "string"},
                "new_value": {"bsonType": "string"},
                "environment": {"bsonType": ["string", "null"]}
            }
        }


class ChangeRequestDocument:
    """MongoDB document structure for Change Request (pending approvals)."""
    
    @staticmethod
    def schema():
        return {
            "bsonType": "object",
            "required": ["flow_id", "requested_by", "requested_at", "status"],
            "properties": {
                "_id": {"bsonType": "objectId"},
                "flow_id": {"bsonType": "objectId"},
                "requested_by": {"bsonType": "string"},
                "requested_at": {"bsonType": "date"},
                "change_description": {"bsonType": "string"},
                "proposed_values": {"bsonType": "object"},
                "status": {"enum": ["pending", "approved", "rejected", "applied"]},
                "approved_by": {"bsonType": "string"},
                "approved_at": {"bsonType": "date"},
                "approval_reason": {"bsonType": "string"},
                "applied_at": {"bsonType": "date"}
            }
        }


class FlowTemplateDocument:
    """MongoDB document structure for reusable flow templates."""

    @staticmethod
    def schema():
        return {
            "bsonType": "object",
            "required": ["project", "repo", "resource_type", "environments", "created_at", "updated_at", "updated_by"],
            "properties": {
                "_id": {"bsonType": "objectId"},
                "project": {"bsonType": "string"},
                "repo": {"bsonType": "string"},
                "repo_url": {"bsonType": ["string", "null"]},
                "resource_type": {"enum": ["webapp", "function_app"]},
                "environments": {
                    "bsonType": "array",
                    "items": {
                        "bsonType": "object",
                        "required": ["name"],
                        "properties": {
                            "name": {"bsonType": "string"},
                            "resource_name": {"bsonType": ["string", "null"]},
                            "resource_group": {"bsonType": ["string", "null"]},
                            "subscription_id": {"bsonType": ["string", "null"]}
                        }
                    }
                },
                "created_at": {"bsonType": "date"},
                "updated_at": {"bsonType": "date"},
                "updated_by": {"bsonType": "string"}
            }
        }


class UserDocument:
    """MongoDB document structure for application users."""

    @staticmethod
    def schema():
        return {
            "bsonType": "object",
            "required": ["email", "password_hash", "role", "created_at", "updated_at", "created_by"],
            "properties": {
                "_id": {"bsonType": "objectId"},
                "email": {"bsonType": "string"},
                "password_hash": {"bsonType": "string"},
                "role": {"enum": ["admin", "devops", "tester"]},
                "created_at": {"bsonType": "date"},
                "updated_at": {"bsonType": "date"},
                "created_by": {"bsonType": "string"},
                "updated_by": {"bsonType": "string"}
            }
        }
