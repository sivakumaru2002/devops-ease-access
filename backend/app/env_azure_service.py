from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from .config import settings

try:
    from azure.identity import ClientSecretCredential
    from azure.mgmt.web import WebSiteManagementClient
    from azure.mgmt.web.models import StringDictionary

    AZURE_SDK_AVAILABLE = True
except ImportError:
    AZURE_SDK_AVAILABLE = False


logger = logging.getLogger(__name__)


class EnvAzureService:
    def __init__(self) -> None:
        self.subscription_id = settings.azure_subscription_id
        self.tenant_id = settings.azure_tenant_id
        self.client_id = settings.azure_client_id
        self.client_secret = settings.azure_client_secret
        self._credential: ClientSecretCredential | None = None
        self._web_clients: dict[str, WebSiteManagementClient] = {}
        self._executor = ThreadPoolExecutor(max_workers=5)

    @property
    def credential(self) -> ClientSecretCredential:
        if self._credential is None:
            if not AZURE_SDK_AVAILABLE:
                raise RuntimeError('Azure SDKs are not installed. Run: pip install azure-identity azure-mgmt-web')
            if not self.client_id or not self.client_secret or not self.tenant_id:
                raise ValueError(
                    'Azure credentials not configured. Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID in backend/.env',
                )

            self._credential = ClientSecretCredential(
                tenant_id=self.tenant_id,
                client_id=self.client_id,
                client_secret=self.client_secret,
            )
        return self._credential

    def get_web_client(self, subscription_id: str | None = None) -> WebSiteManagementClient:
        target_subscription = subscription_id or self.subscription_id
        if not target_subscription:
            raise ValueError('AZURE_SUBSCRIPTION_ID is not configured and no subscription_id was provided')

        if target_subscription not in self._web_clients:
            self._web_clients[target_subscription] = WebSiteManagementClient(
                credential=self.credential,
                subscription_id=target_subscription,
            )

        return self._web_clients[target_subscription]

    async def get_webapp_settings(
        self,
        resource_group: str,
        webapp_name: str,
        subscription_id: str | None = None,
    ) -> dict[str, str] | None:
        try:
            web_client = self.get_web_client(subscription_id)
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                self._executor,
                web_client.web_apps.list_application_settings,
                resource_group,
                webapp_name,
            )
            return dict(result.properties) if result.properties else {}
        except Exception:
            logger.exception('Failed to read webapp settings for %s', webapp_name)
            return None

    async def get_function_app_settings(
        self,
        resource_group: str,
        function_app_name: str,
        subscription_id: str | None = None,
    ) -> dict[str, str] | None:
        try:
            web_client = self.get_web_client(subscription_id)
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                self._executor,
                web_client.web_apps.list_application_settings,
                resource_group,
                function_app_name,
            )
            return dict(result.properties) if result.properties else {}
        except Exception:
            logger.exception('Failed to read function app settings for %s', function_app_name)
            return None

    async def apply_to_webapp(
        self,
        resource_group: str,
        webapp_name: str,
        env_variables: dict[str, str],
        subscription_id: str | None = None,
    ) -> tuple[bool, str, dict[str, Any]]:
        try:
            app_settings = StringDictionary(properties=env_variables)
            web_client = self.get_web_client(subscription_id)
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                self._executor,
                web_client.web_apps.update_application_settings,
                resource_group,
                webapp_name,
                app_settings,
            )
            applied_keys = list(result.properties.keys()) if result.properties else []
            return True, f'Successfully applied settings to WebApp {webapp_name}', {
                'resource_group': resource_group,
                'resource_name': webapp_name,
                'applied_keys': applied_keys,
            }
        except Exception as ex:
            message = f'Failed to apply settings to WebApp {webapp_name}: {ex}'
            logger.exception(message)
            return False, message, {'error': str(ex), 'resource_name': webapp_name, 'resource_group': resource_group}

    async def apply_to_function_app(
        self,
        resource_group: str,
        function_app_name: str,
        env_variables: dict[str, str],
        subscription_id: str | None = None,
    ) -> tuple[bool, str, dict[str, Any]]:
        try:
            app_settings = StringDictionary(properties=env_variables)
            web_client = self.get_web_client(subscription_id)
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                self._executor,
                web_client.web_apps.update_application_settings,
                resource_group,
                function_app_name,
                app_settings,
            )
            applied_keys = list(result.properties.keys()) if result.properties else []
            return True, f'Successfully applied settings to Function App {function_app_name}', {
                'resource_group': resource_group,
                'resource_name': function_app_name,
                'applied_keys': applied_keys,
            }
        except Exception as ex:
            message = f'Failed to apply settings to Function App {function_app_name}: {ex}'
            logger.exception(message)
            return False, message, {'error': str(ex), 'resource_name': function_app_name, 'resource_group': resource_group}

    async def validate_credentials(self) -> tuple[bool, str]:
        try:
            if not self.client_id or not self.client_secret or not self.tenant_id:
                return False, 'Azure credentials not configured (missing client_id, client_secret, or tenant_id)'
            if not self.subscription_id:
                return False, 'AZURE_SUBSCRIPTION_ID not configured'

            loop = asyncio.get_running_loop()
            token = await loop.run_in_executor(
                self._executor,
                self.credential.get_token,
                'https://management.azure.com/.default',
            )
            if token:
                return True, f'Azure credentials validated successfully for tenant {self.tenant_id}'
            return False, 'Failed to obtain Azure token'
        except Exception as ex:
            return False, f'Azure credential validation failed: {ex}'


_env_azure_service: EnvAzureService | None = None


def get_env_azure_service() -> EnvAzureService:
    global _env_azure_service
    if _env_azure_service is None:
        _env_azure_service = EnvAzureService()
    return _env_azure_service