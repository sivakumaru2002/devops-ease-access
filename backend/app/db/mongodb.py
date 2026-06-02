import motor.motor_asyncio
from pymongo import ASCENDING, DESCENDING
from app.config import settings
from app.db.mongo_schemas import (
    FlowDocument, SnapshotDocument, AuditLogDocument, ChangeRequestDocument, FlowTemplateDocument, UserDocument
)
import json
from datetime import datetime


class MongoDB:
    """MongoDB connection and collection management."""
    
    client: motor.motor_asyncio.AsyncIOMotorClient = None
    db: motor.motor_asyncio.AsyncIOMotorDatabase = None
    
    @classmethod
    async def connect(cls):
        """Initialize MongoDB connection and create collections if needed."""
        cls.client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URL)
        cls.db = cls.client[settings.MONGODB_DATABASE]
        
        # Create collections
        await cls._create_collections()
    
    @classmethod
    async def disconnect(cls):
        """Close MongoDB connection."""
        if cls.client:
            cls.client.close()
    
    @classmethod
    async def _create_collections(cls):
        """Create collections with validators and indices."""
        # Flows collection
        try:
            await cls.db.create_collection(
                "flows",
                validator={"$jsonSchema": FlowDocument.schema()}
            )
        except Exception:
            await cls.db.command(
                "collMod",
                "flows",
                validator={"$jsonSchema": FlowDocument.schema()}
            )
        
        # Create indices for flows
        flows_col = cls.db["flows"]
        await flows_col.create_index([("repo_url", ASCENDING)])
        await flows_col.create_index([("resource_name", ASCENDING)])
        await flows_col.create_index([("created_at", DESCENDING)])
        await flows_col.create_index([("tags.release_id", ASCENDING)])
        
        # Snapshots collection
        try:
            await cls.db.create_collection(
                "snapshots",
                validator={"$jsonSchema": SnapshotDocument.schema()}
            )
        except Exception:
            await cls.db.command(
                "collMod",
                "snapshots",
                validator={"$jsonSchema": SnapshotDocument.schema()}
            )
        
        snapshots_col = cls.db["snapshots"]
        await snapshots_col.create_index([("flow_id", ASCENDING)])
        await snapshots_col.create_index([("created_at", DESCENDING)])
        
        # Audit logs collection
        try:
            await cls.db.create_collection(
                "audit_logs",
                validator={"$jsonSchema": AuditLogDocument.schema()}
            )
        except Exception:
            await cls.db.command(
                "collMod",
                "audit_logs",
                validator={"$jsonSchema": AuditLogDocument.schema()}
            )
        
        audit_col = cls.db["audit_logs"]
        await audit_col.create_index([("flow_id", ASCENDING)])
        await audit_col.create_index([("performed_at", DESCENDING)])
        
        # Change requests collection
        try:
            await cls.db.create_collection(
                "change_requests",
                validator={"$jsonSchema": ChangeRequestDocument.schema()}
            )
        except Exception:
            await cls.db.command(
                "collMod",
                "change_requests",
                validator={"$jsonSchema": ChangeRequestDocument.schema()}
            )
        
        change_col = cls.db["change_requests"]
        await change_col.create_index([("flow_id", ASCENDING)])
        await change_col.create_index([("status", ASCENDING)])
        await change_col.create_index([("requested_at", DESCENDING)])

        # Flow templates collection
        try:
            await cls.db.create_collection(
                "flow_templates",
                validator={"$jsonSchema": FlowTemplateDocument.schema()}
            )
        except Exception:
            await cls.db.command(
                "collMod",
                "flow_templates",
                validator={"$jsonSchema": FlowTemplateDocument.schema()}
            )

        templates_col = cls.db["flow_templates"]
        await templates_col.create_index([("project", ASCENDING), ("repo", ASCENDING)], unique=True)
        await templates_col.create_index([("updated_at", DESCENDING)])

        # Users collection
        try:
            await cls.db.create_collection(
                "users",
                validator={"$jsonSchema": UserDocument.schema()}
            )
        except Exception:
            await cls.db.command(
                "collMod",
                "users",
                validator={"$jsonSchema": UserDocument.schema()}
            )

        users_col = cls.db["users"]
        await users_col.create_index([("email", ASCENDING)], unique=True)
        await users_col.create_index([("role", ASCENDING)])
        await users_col.create_index([("updated_at", DESCENDING)])

        await cls._seed_bootstrap_users(users_col)

    @classmethod
    async def _seed_bootstrap_users(cls, users_col):
        """Seed bootstrap users from environment when they do not exist yet."""
        from app.auth import hash_password

        try:
            configured_users = json.loads(settings.AUTH_USERS_JSON)
        except json.JSONDecodeError:
            return

        now = datetime.utcnow()
        for item in configured_users:
            email = str(item.get("email") or item.get("username") or "").strip().lower()
            password = str(item.get("password") or "").strip()
            role = str(item.get("role") or "").strip().lower()

            if not email or not password or role not in {"admin", "devops", "tester"}:
                continue

            existing = await users_col.find_one({"email": email})
            if existing:
                continue

            await users_col.insert_one(
                {
                    "email": email,
                    "password_hash": hash_password(password),
                    "role": role,
                    "created_at": now,
                    "updated_at": now,
                    "created_by": "bootstrap",
                    "updated_by": "bootstrap",
                }
            )
    
    @classmethod
    def get_db(cls):
        """Get database instance."""
        return cls.db


# Dependency for FastAPI
async def get_db():
    """Get database for dependency injection in routes."""
    return MongoDB.get_db()
