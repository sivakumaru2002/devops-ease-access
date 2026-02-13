from cryptography.fernet import Fernet
from .config import settings


def _load_key() -> bytes:
    if settings.app_encryption_key:
        key = settings.app_encryption_key.encode("utf-8")
        # Validate key format early to fail fast on misconfiguration.
        Fernet(key)
        return key
    return Fernet.generate_key()


FERNET = Fernet(_load_key())


def encrypt_secret(secret: str) -> str:
    return FERNET.encrypt(secret.encode("utf-8")).decode("utf-8")


def decrypt_secret(encrypted_secret: str) -> str:
    return FERNET.decrypt(encrypted_secret.encode("utf-8")).decode("utf-8")
