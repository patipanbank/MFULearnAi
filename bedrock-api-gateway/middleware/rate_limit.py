from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging
import time
from typing import Dict, Optional, Callable
import asyncio
from collections import defaultdict, deque
from datetime import datetime, timedelta

from config.config import settings

logger = logging.getLogger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    In-memory rate limiting middleware
    For production, consider using Redis for distributed rate limiting
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.requests_per_minute = settings.RATE_LIMIT_REQUESTS
        self.window_seconds = settings.RATE_LIMIT_WINDOW
        
        # In-memory storage for rate limiting
        # Format: {api_key: deque([timestamp1, timestamp2, ...])}
        self.request_counts: Dict[str, deque] = defaultdict(deque)
        
        # Lock for thread safety
        self.lock = asyncio.Lock()
        
        logger.info(f"Rate limiting: {self.requests_per_minute} requests per {self.window_seconds} seconds")
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for public endpoints
        public_endpoints = {
            "/",
            "/docs",
            "/redoc",
            "/openapi.json",
            "/health"
        }
        
        if request.url.path in public_endpoints:
            return await call_next(request)
        
        # Get API key from request state (set by auth middleware)
        api_key = getattr(request.state, 'api_key', None)
        
        if not api_key:
            # If no API key, use IP address for rate limiting
            api_key = self._get_client_ip(request)
        
        # Check rate limit
        if await self._is_rate_limited(api_key):
            logger.warning(f"Rate limit exceeded for {api_key}")
            
            return Response(
                content='{"error": "Rate limit exceeded", "detail": "Too many requests. Please try again later."}',
                status_code=429,
                media_type="application/json",
                headers={
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Window": str(self.window_seconds),
                    "X-RateLimit-Remaining": "0",
                    "Retry-After": str(self.window_seconds)
                }
            )
        
        # Record the request
        await self._record_request(api_key)
        
        # Add rate limit headers to response
        response = await call_next(request)
        
        remaining = await self._get_remaining_requests(api_key)
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Window"] = str(self.window_seconds)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Get client IP address"""
        # Try to get real IP from headers (for reverse proxy setups)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct connection IP
        return request.client.host if request.client else "unknown"
    
    async def _is_rate_limited(self, identifier: str) -> bool:
        """Check if the identifier is rate limited"""
        async with self.lock:
            now = time.time()
            window_start = now - self.window_seconds
            
            # Get request timestamps for this identifier
            request_times = self.request_counts[identifier]
            
            # Remove old requests outside the window
            while request_times and request_times[0] < window_start:
                request_times.popleft()
            
            # Check if we've exceeded the limit
            return len(request_times) >= self.requests_per_minute
    
    async def _record_request(self, identifier: str):
        """Record a request for rate limiting"""
        async with self.lock:
            now = time.time()
            self.request_counts[identifier].append(now)
    
    async def _get_remaining_requests(self, identifier: str) -> int:
        """Get remaining requests for the identifier"""
        async with self.lock:
            now = time.time()
            window_start = now - self.window_seconds
            
            # Get request timestamps for this identifier
            request_times = self.request_counts[identifier]
            
            # Remove old requests outside the window
            while request_times and request_times[0] < window_start:
                request_times.popleft()
            
            # Calculate remaining requests
            current_count = len(request_times)
            return max(0, self.requests_per_minute - current_count)
    
    async def cleanup_old_entries(self):
        """Cleanup old entries to prevent memory leaks"""
        async with self.lock:
            now = time.time()
            window_start = now - self.window_seconds
            
            # Clean up old entries
            keys_to_remove = []
            for identifier, request_times in self.request_counts.items():
                while request_times and request_times[0] < window_start:
                    request_times.popleft()
                
                # Remove empty entries
                if not request_times:
                    keys_to_remove.append(identifier)
            
            for key in keys_to_remove:
                del self.request_counts[key]
            
            logger.debug(f"Cleaned up {len(keys_to_remove)} old rate limit entries")


# Background task to cleanup old entries
async def cleanup_rate_limit_entries(middleware: RateLimitMiddleware):
    """Background task to cleanup old rate limit entries"""
    while True:
        try:
            await asyncio.sleep(300)  # Clean up every 5 minutes
            await middleware.cleanup_old_entries()
        except Exception as e:
            logger.error(f"Error in rate limit cleanup: {e}")
            await asyncio.sleep(60)  # Wait a minute before retrying 