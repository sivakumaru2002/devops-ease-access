"""
Azure WebApp and Function App integration using Client ID and Secret.

This service handles authentication to Azure using client credentials
and applies environment variable changes to Azure resources.
"""

from typing import Dict, List, Optional, Tuple
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
from app.config import settings

# Import Azure SDKs
try:
    from azure.identity import ClientSecretCredential
    from azure.mgmt.web import WebSiteManagementClient
    from azure.mgmt.web.models import StringDictionary
    AZURE_SDK_AVAILABLE = True
except ImportError:
    AZURE_SDK_AVAILABLE = False
    logging.warning("Azure SDKs not installed. Azure integration will not work.")

logger = logging.getLogger(__name__)


class AzureService:
    """Service for interacting with Azure WebApps and Function Apps."""
    
    def __init__(self):
        """Initialize Azure service with client credentials."""
        self.subscription_id = settings.AZURE_SUBSCRIPTION_ID
        self.tenant_id = settings.AZURE_TENANT_ID
        self.client_id = settings.AZURE_CLIENT_ID
        self.client_secret = settings.AZURE_CLIENT_SECRET
        
        self._credential = None
        self._web_clients = {}
        self._executor = ThreadPoolExecutor(max_workers=5)
    
    @property
    def credential(self):
        """Lazy-load credential."""
        if self._credential is None:
            if not AZURE_SDK_AVAILABLE:
                raise RuntimeError("Azure SDKs are not installed. Run: pip install azure-identity azure-mgmt-web")
            
            if not self.client_id or not self.client_secret or not self.tenant_id:
                raise ValueError(
                    "Azure credentials not configured. "
                    "Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, and AZURE_TENANT_ID in .env"
                )
            
            self._credential = ClientSecretCredential(
                tenant_id=self.tenant_id,
                client_id=self.client_id,
                client_secret=self.client_secret
            )
            logger.info(f"Azure ClientSecretCredential initialized for tenant {self.tenant_id}")
        
        return self._credential
    
    def get_web_client(self, subscription_id: Optional[str] = None):
        """Get WebSiteManagementClient for the provided or default subscription."""
        target_subscription = subscription_id or self.subscription_id
        if not target_subscription:
            raise ValueError("AZURE_SUBSCRIPTION_ID not configured in .env and no subscription_id was provided")

        if target_subscription not in self._web_clients:
            self._web_clients[target_subscription] = WebSiteManagementClient(
                credential=self.credential,
                subscription_id=target_subscription
            )
            logger.info(f"WebSiteManagementClient initialized for subscription {target_subscription}")

        return self._web_clients[target_subscription]
    
    async def apply_to_webapp(
        self,
        resource_group: str,
        webapp_name: str,
        env_variables: Dict[str, str],
        subscription_id: Optional[str] = None
    ) -> Tuple[bool, str, Dict]:
        """
        Apply environment variables to an Azure WebApp.
        
        Args:
            resource_group: Azure resource group name
            webapp_name: WebApp name
            env_variables: Dict of key-value pairs to set
        
        Returns:
            Tuple of (success: bool, message: str, details: Dict)
        """
        try:
            logger.info(f"Applying {len(env_variables)} variables to WebApp {webapp_name}")
            
            # Create StringDictionary of app settings
            app_settings = StringDictionary(properties=env_variables)
            web_client = self.get_web_client(subscription_id)
            loop = asyncio.get_event_loop()
            
            # Run synchronous Azure SDK call in thread executor to avoid blocking event loop
            result = await loop.run_in_executor(
                self._executor,
                web_client.web_apps.update_application_settings,
                resource_group,
                webapp_name,
                app_settings
            )
            
            applied_keys = list(result.properties.keys()) if result.properties else []
            message = f"Successfully applied {len(applied_keys)} settings to WebApp {webapp_name}"
            
            logger.info(message)
            return (
                True,
                message,
                {
                    "webapp_name": webapp_name,
                    "resource_group": resource_group,
                    "applied_keys": applied_keys,
                    "count": len(applied_keys)
                }
            )
        
        except Exception as e:
            error_msg = f"Failed to apply settings to WebApp {webapp_name}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return (
                False,
                error_msg,
                {
                    "webapp_name": webapp_name,
                    "resource_group": resource_group,
                    "error": str(e),
                    "error_type": type(e).__name__
                }
            )
    
    async def apply_to_function_app(
        self,
        resource_group: str,
        function_app_name: str,
        env_variables: Dict[str, str],
        subscription_id: Optional[str] = None
    ) -> Tuple[bool, str, Dict]:
        """
        Apply environment variables to an Azure Function App.
        
        Function Apps use the same configuration API as WebApps.
        
        Args:
            resource_group: Azure resource group name
            function_app_name: Function App name
            env_variables: Dict of key-value pairs to set
        
        Returns:
            Tuple of (success: bool, message: str, details: Dict)
        """
        try:
            logger.info(f"Applying {len(env_variables)} variables to Function App {function_app_name}")
            
            # Create StringDictionary of app settings
            app_settings = StringDictionary(properties=env_variables)
            web_client = self.get_web_client(subscription_id)
            loop = asyncio.get_event_loop()
            
            # Run synchronous Azure SDK call in thread executor to avoid blocking event loop
            result = await loop.run_in_executor(
                self._executor,
                web_client.web_apps.update_application_settings,
                resource_group,
                function_app_name,
                app_settings
            )
            
            applied_keys = list(result.properties.keys()) if result.properties else []
            message = f"Successfully applied {len(applied_keys)} settings to Function App {function_app_name}"
            
            logger.info(message)
            return (
                True,
                message,
                {
                    "function_app_name": function_app_name,
                    "resource_group": resource_group,
                    "applied_keys": applied_keys,
                    "count": len(applied_keys)
                }
            )
        
        except Exception as e:
            error_msg = f"Failed to apply settings to Function App {function_app_name}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return (
                False,
                error_msg,
                {
                    "function_app_name": function_app_name,
                    "resource_group": resource_group,
                    "error": str(e),
                    "error_type": type(e).__name__
                }
            )
    
    async def get_webapp_settings(
        self,
        resource_group: str,
        webapp_name: str,
        subscription_id: Optional[str] = None
    ) -> Optional[Dict[str, str]]:
        """
        Retrieve current application settings from a WebApp.
        
        Useful for validation and reading current state.
        """
        try:
            web_client = self.get_web_client(subscription_id)
            loop = asyncio.get_event_loop()
            
            # Run synchronous Azure SDK call in thread executor
            result = await loop.run_in_executor(
                self._executor,
                web_client.web_apps.list_application_settings,
                resource_group,
                webapp_name
            )
            return dict(result.properties) if result.properties else {}
        except Exception as e:
            logger.error(f"Failed to get settings from WebApp {webapp_name}: {str(e)}")
            return None
    
    async def get_function_app_settings(
        self,
        resource_group: str,
        function_app_name: str,
        subscription_id: Optional[str] = None
    ) -> Optional[Dict[str, str]]:
        """
        Retrieve current application settings from a Function App.
        """
        try:
            web_client = self.get_web_client(subscription_id)
            loop = asyncio.get_event_loop()
            
            # Run synchronous Azure SDK call in thread executor
            result = await loop.run_in_executor(
                self._executor,
                web_client.web_apps.list_application_settings,
                resource_group,
                function_app_name
            )
            return dict(result.properties) if result.properties else {}
        except Exception as e:
            logger.error(f"Failed to get settings from Function App {function_app_name}: {str(e)}")
            return None
    
    async def validate_credentials(self) -> Tuple[bool, str]:
        """
        Validate that Azure credentials are configured and accessible.
        
        Returns:
            Tuple of (valid: bool, message: str)
        """
        try:
            if not self.client_id or not self.client_secret or not self.tenant_id:
                return (False, "Azure credentials not configured (missing client_id, client_secret, or tenant_id)")
            
            if not self.subscription_id:
                return (False, "AZURE_SUBSCRIPTION_ID not configured")
            
            # Try to get a token to validate credentials
            token = self.credential.get_token("https://management.azure.com/.default")
            if token:
                return (True, f"Azure credentials validated successfully for tenant {self.tenant_id}")
            else:
                return (False, "Failed to obtain Azure token")
        
        except Exception as e:
            return (False, f"Azure credential validation failed: {str(e)}")


# Singleton instance
_azure_service = None


def get_azure_service() -> AzureService:
    """Get or create singleton AzureService instance."""
    global _azure_service
    if _azure_service is None:
        _azure_service = AzureService()
    return _azure_service
