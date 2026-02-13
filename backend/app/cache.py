import time
from typing import Any


class TTLCache:
    def __init__(self, ttl_seconds: int = 120):
        self.ttl_seconds = ttl_seconds
        self._store: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        val = self._store.get(key)
        if not val:
            return None
        expires_at, payload = val
        if expires_at < time.time():
            self._store.pop(key, None)
            return None
        return payload

    def set(self, key: str, payload: Any) -> None:
        self._store[key] = (time.time() + self.ttl_seconds, payload)
