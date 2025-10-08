import redis
import time
import logging
import asyncio
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
from typing import Optional, Callable, cast
import json
from datetime import datetime, timedelta

from config.config import settings

logger = logging.getLogger(__name__)

class RedisRateLimitMiddleware(BaseHTTPMiddleware):
    """
    Production-ready Redis-based rate limiting middleware
    Supports distributed rate limiting across multiple instances
    """
    # Class-level flag so static introspection works
    use_redis: bool = True

    def __init__(self, app):
        super().__init__(app)
        self.requests_per_minute = settings.RATE_LIMIT_REQUESTS
        self.window_seconds = settings.RATE_LIMIT_WINDOW
        
        # Initialize Redis connection
        self.redis_client = None
        # Instance flag based on settings; also mirror to class attr for introspection safety
        self.use_redis = bool(settings.REDIS_URL)
        RedisRateLimitMiddleware.use_redis = self.use_redis
        
        if self.use_redis:
            try:
                redis_url: str = cast(str, settings.REDIS_URL)  # assured non-None by self.use_redis
                self.redis_client = cast(redis.Redis, redis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                    retry_on_timeout=True,
                    health_check_interval=30
                ))
                # Test connection
                self.redis_client.ping()
                logger.info(f"Redis rate limiting enabled: {self.requests_per_minute} requests per {self.window_seconds}s")
            except Exception as e:
                logger.error(f"Failed to connect to Redis: {e}")
                logger.warning("Falling back to in-memory rate limiting")
                self.use_redis = False
                RedisRateLimitMiddleware.use_redis = self.use_redis
                
        if not self.use_redis:
            # Fallback to in-memory rate limiting
            from collections import defaultdict, deque
            self.request_counts = defaultdict(deque)
            logger.info("Using in-memory rate limiting (not recommended for production)")
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip rate limiting for public endpoints
        public_endpoints = {
            "/", "/docs", "/redoc", "/openapi.json", "/health"
        }
        
        if request.url.path in public_endpoints:
            return await call_next(request)
        
        # Get identifier for rate limiting
        identifier = self._get_rate_limit_identifier(request)
        
        # Check rate limit
        is_limited, remaining, reset_time = await self._check_rate_limit(identifier)
        
        if is_limited:
            logger.warning(f"Rate limit exceeded for {identifier}")
            return Response(
                content=json.dumps({
                    "error": "Rate limit exceeded",
                    "detail": "Too many requests. Please try again later.",
                    "retry_after": reset_time
                }),
                status_code=429,
                media_type="application/json",
                headers={
                    "X-RateLimit-Limit": str(self.requests_per_minute),
                    "X-RateLimit-Remaining": str(remaining),
                    "X-RateLimit-Reset": str(reset_time),
                    "Retry-After": str(self.window_seconds)
                }
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_time)
        
        return response
    
    def _get_rate_limit_identifier(self, request: Request) -> str:
        """Get identifier for rate limiting (API key or IP)"""
        # Use API key if available
        api_key = getattr(request.state, 'api_key', None)
        if api_key:
            return f"api_key:{api_key}"
        
        # Fallback to IP address
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            ip = forwarded_for.split(",")[0].strip()
        else:
            ip = request.client.host if request.client else "unknown"
        
        return f"ip:{ip}"
    
    async def _check_rate_limit(self, identifier: str) -> tuple[bool, int, int]:
        """
        Check rate limit and return (is_limited, remaining_requests, reset_time)
        """
        if self.use_redis:
            return await self._check_rate_limit_redis(identifier)
        else:
            return await self._check_rate_limit_memory(identifier)
    
    async def _check_rate_limit_redis(self, identifier: str) -> tuple[bool, int, int]:
        """Redis-based rate limiting"""
        assert self.redis_client is not None  # safety for type checker
        now = int(time.time())
        window_start = now - self.window_seconds
        
        try:
            # Use Redis pipeline for atomic operations
            pipe = self.redis_client.pipeline()
            
            # Remove old entries
            pipe.zremrangebyscore(identifier, 0, window_start)
            
            # Count current requests in window
            pipe.zcard(identifier)
            
            # Add current request
            pipe.zadd(identifier, {str(now): now})
            
            # Set expiry
            pipe.expire(identifier, self.window_seconds)
            
            # Execute pipeline
            results = pipe.execute()
            current_count = results[1]  # Count before adding current request
            
            # Calculate remaining and reset time
            remaining = max(0, self.requests_per_minute - current_count - 1)
            reset_time = now + self.window_seconds
            
            # Check if rate limit exceeded
            is_limited = current_count >= self.requests_per_minute
            
            if is_limited:
                # Remove the request we just added since it's rejected
                self.redis_client.zrem(identifier, str(now))
                remaining = 0
            
            return is_limited, remaining, reset_time
            
        except Exception as e:
            logger.error(f"Redis rate limiting error: {e}")
            # Fallback: allow request if Redis fails
            return False, self.requests_per_minute, now + self.window_seconds
    
    async def _check_rate_limit_memory(self, identifier: str) -> tuple[bool, int, int]:
        """Memory-based rate limiting (fallback)"""
        now = time.time()
        window_start = now - self.window_seconds
        
        # Get request timestamps for this identifier
        request_times = self.request_counts[identifier]
        
        # Remove old requests outside the window
        while request_times and request_times[0] < window_start:
            request_times.popleft()
        
        # Check if we've exceeded the limit
        current_count = len(request_times)
        is_limited = current_count >= self.requests_per_minute
        
        if not is_limited:
            # Add current request
            request_times.append(now)
        
        # Calculate remaining and reset time
        remaining = max(0, self.requests_per_minute - current_count - (0 if is_limited else 1))
        reset_time = int(now + self.window_seconds)
        
        return is_limited, remaining, reset_time
    
    async def get_rate_limit_stats(self, identifier: str) -> dict:
        """Get rate limit statistics for monitoring"""
        if not self.use_redis:
            return {"error": "Stats only available with Redis"}
        
        try:
            assert self.redis_client is not None
            now = int(time.time())
            window_start = now - self.window_seconds
            
            # Clean old entries and count current
            pipe = self.redis_client.pipeline()
            pipe.zremrangebyscore(identifier, 0, window_start)
            pipe.zcard(identifier)
            pipe.zrange(identifier, 0, -1, withscores=True)
            
            results = pipe.execute()
            current_count = results[1]
            requests = results[2]
            
            return {
                "identifier": identifier,
                "current_count": current_count,
                "limit": self.requests_per_minute,
                "window_seconds": self.window_seconds,
                "remaining": max(0, self.requests_per_minute - current_count),
                "reset_time": now + self.window_seconds,
                "requests": [{"timestamp": score, "request_id": member} for member, score in requests]
            }
            
        except Exception as e:
            logger.error(f"Error getting rate limit stats: {e}")
            return {"error": str(e)}

# Background task for cleanup (if using memory-based fallback)
async def cleanup_memory_rate_limits(middleware):
    """Background task to cleanup old rate limit entries in memory"""
    if middleware.use_redis:
        return  # No need for cleanup with Redis
        
    while True:
        try:
            await asyncio.sleep(300)  # Clean up every 5 minutes
            now = time.time()
            window_start = now - middleware.window_seconds
            
            # Clean up old entries
            keys_to_remove = []
            for identifier, request_times in middleware.request_counts.items():
                while request_times and request_times[0] < window_start:
                    request_times.popleft()
                
                # Remove empty entries
                if not request_times:
                    keys_to_remove.append(identifier)
            
            for key in keys_to_remove:
                del middleware.request_counts[key]
            
            logger.debug(f"Cleaned up {len(keys_to_remove)} old rate limit entries")
            
        except Exception as e:
            logger.error(f"Error in rate limit cleanup: {e}")
            await asyncio.sleep(60)  # Wait a minute before retrying 