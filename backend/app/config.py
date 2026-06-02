from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "DevOps Ease Access API"
    app_version: str = "1.0.0"
    debug: bool = False
    app_encryption_key: str = ""
    session_ttl_minutes: int = 30
    cache_ttl_seconds: int = 120

    mongodb_uri: str | None = None
    mongodb_database: str = "devops_ease_access"
    mongodb_collection: str = "resources"

    azure_subscription_id: str = ""
    azure_tenant_id: str = ""
    azure_client_id: str = ""
    azure_client_secret: str = ""

    azure_openai_endpoint: str | None = None
    azure_openai_api_key: str | None = None
    azure_openai_deployment: str | None = None
    azure_openai_api_version: str = "2024-02-15-preview"
    auth_users_json: str | None = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
