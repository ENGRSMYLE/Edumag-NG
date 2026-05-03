from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# In test environment rate limiting is disabled so tests can call endpoints freely.
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["5/minute"],
    enabled=settings.ENVIRONMENT != "test",
)
