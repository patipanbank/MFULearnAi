from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging
from typing import Optional, Set, Callable
import time
import uuid

from config.config import settings

logger = logging.getLogger(__name__)

class APIKeyMiddleware(BaseHTTPMiddleware):
    """
    Middleware to validate API keys for all requests
    """
    
    def __init__(self, app, api_keys: Optional[Set[str]] = None):
        super().__init__(app)
        # Load API keys from settings
        if api_keys:
            self.api_keys = api_keys
        else:
            self.api_keys = self._to_key_set(settings.API_KEYS)
        
        # Public endpoints that don't require API key
        self.public_endpoints = {
            "/",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health",
            "/api/v1/models",
            "/metrics"  # Prometheus metrics endpoint
        }
        
        logger.info(f"API Key middleware initialized with {len(self.api_keys)} keys")

    @staticmethod
    def _to_key_set(raw_keys) -> Set[str]:
        """Convert settings.API_KEYS (list or str or None) to set[str]."""
        if isinstance(raw_keys, list):
            return set(map(str.strip, raw_keys))
        raw = str(raw_keys or "")
        return {k.strip() for k in raw.split(',') if k.strip()}
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID for logging
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        
        # Check if endpoint is public
        if request.url.path in self.public_endpoints:
            return await call_next(request)
        
        # Check for API key
        api_key = self._extract_api_key(request)
        
        if not api_key:
            logger.warning(f"Request {request_id}: Missing API key for {request.url.path}")
            return Response(
                content='{"error": "API key required", "detail": "Provide X-API-Key header or Authorization Bearer token"}',
                status_code=401,
                media_type="application/json"
            )
        
        if not self._validate_api_key(api_key):
            logger.warning(f"Request {request_id}: Invalid API key for {request.url.path}")
            return Response(
                content='{"error": "Invalid API key", "detail": "The provided API key is not valid"}',
                status_code=401,
                media_type="application/json"
            )
        
        # Add API key info to request state
        request.state.api_key = api_key
        request.state.authenticated = True
        
        logger.info(f"Request {request_id}: Authenticated request to {request.url.path}")
        
        return await call_next(request)
    
    def _extract_api_key(self, request: Request) -> Optional[str]:
        """Extract API key from request headers"""
        # Check X-API-Key header
        api_key = request.headers.get("X-API-Key")
        if api_key:
            return api_key
        
        # Check Authorization header (Bearer token)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header[7:]  # Remove "Bearer " prefix
        
        return None
    
    def _validate_api_key(self, api_key: str) -> bool:
        """Validate API key against configured keys"""
        if not self.api_keys:
            # If no API keys configured, allow all requests (development mode)
            logger.warning("No API keys configured - allowing all requests")
            return True
        
        return api_key in self.api_keys


# Security utility for FastAPI dependencies
security = HTTPBearer(auto_error=False)

async def get_api_key(credentials: Optional[HTTPAuthorizationCredentials] = None) -> str:
    """FastAPI dependency for API key validation"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    api_keys = APIKeyMiddleware._to_key_set(settings.API_KEYS)
    
    if not api_keys:
        logger.warning("No API keys configured - allowing all requests")
        return credentials.credentials
    
    if credentials.credentials not in api_keys:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return credentials.credentials 