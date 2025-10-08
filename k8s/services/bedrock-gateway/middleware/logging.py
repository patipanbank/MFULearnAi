from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response
import logging
import time
import json
from typing import Callable
from datetime import datetime

from config.config import settings

logger = logging.getLogger(__name__)

class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all requests and responses
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.log_requests = settings.LOG_REQUESTS
        self.log_responses = settings.LOG_RESPONSES
        
        # Configure structured logging
        self.request_logger = logging.getLogger("api_gateway.requests")
        self.response_logger = logging.getLogger("api_gateway.responses")
        
        logger.info(f"Logging middleware initialized - requests: {self.log_requests}, responses: {self.log_responses}")
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()
        
        # Get request ID from state (set by auth middleware)
        request_id = getattr(request.state, 'request_id', 'unknown')
        
        # Log incoming request
        if self.log_requests:
            await self._log_request(request, request_id)
        
        # Process request
        response = await call_next(request)
        
        # Calculate processing time
        process_time = time.time() - start_time
        
        # Log response
        if self.log_responses:
            await self._log_response(request, response, request_id, process_time)
        
        # Add processing time to response headers
        response.headers["X-Process-Time"] = str(process_time)
        response.headers["X-Request-ID"] = request_id
        
        return response
    
    async def _log_request(self, request: Request, request_id: str):
        """Log incoming request details"""
        try:
            # Get API key (if available)
            api_key = getattr(request.state, 'api_key', None)
            api_key_masked = f"{api_key[:8]}..." if api_key and len(api_key) > 8 else "none"
            
            # Get client IP
            client_ip = self._get_client_ip(request)
            
            # Prepare request data
            request_data = {
                "timestamp": datetime.now().isoformat(),
                "request_id": request_id,
                "method": request.method,
                "url": str(request.url),
                "path": request.url.path,
                "client_ip": client_ip,
                "api_key": api_key_masked,
                "user_agent": request.headers.get("User-Agent", "unknown"),
                "content_type": request.headers.get("Content-Type"),
                "content_length": request.headers.get("Content-Length"),
                "headers": dict(request.headers) if logger.isEnabledFor(logging.DEBUG) else None
            }
            
            # Log request
            self.request_logger.info(json.dumps(request_data))
            
        except Exception as e:
            logger.error(f"Error logging request {request_id}: {e}")
    
    async def _log_response(self, request: Request, response: Response, request_id: str, process_time: float):
        """Log response details"""
        try:
            # Get API key (if available)
            api_key = getattr(request.state, 'api_key', None)
            api_key_masked = f"{api_key[:8]}..." if api_key and len(api_key) > 8 else "none"
            
            # Get client IP
            client_ip = self._get_client_ip(request)
            
            # Prepare response data
            response_data = {
                "timestamp": datetime.now().isoformat(),
                "request_id": request_id,
                "method": request.method,
                "url": str(request.url),
                "path": request.url.path,
                "client_ip": client_ip,
                "api_key": api_key_masked,
                "status_code": response.status_code,
                "process_time": round(process_time, 4),
                "content_type": response.headers.get("Content-Type"),
                "content_length": response.headers.get("Content-Length"),
                "headers": dict(response.headers) if logger.isEnabledFor(logging.DEBUG) else None
            }
            
            # Log response
            if response.status_code >= 400:
                self.response_logger.error(json.dumps(response_data))
            else:
                self.response_logger.info(json.dumps(response_data))
                
        except Exception as e:
            logger.error(f"Error logging response {request_id}: {e}")
    
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


# Security-focused logging for audit trails
class SecurityAuditLogger:
    """
    Specialized logger for security events
    """
    
    def __init__(self):
        self.logger = logging.getLogger("api_gateway.security")
        
    def log_authentication_success(self, request_id: str, api_key: str, client_ip: str, endpoint: str):
        """Log successful authentication"""
        self.logger.info(json.dumps({
            "event": "authentication_success",
            "timestamp": datetime.now().isoformat(),
            "request_id": request_id,
            "api_key": f"{api_key[:8]}..." if len(api_key) > 8 else api_key,
            "client_ip": client_ip,
            "endpoint": endpoint
        }))
    
    def log_authentication_failure(self, request_id: str, client_ip: str, endpoint: str, reason: str):
        """Log failed authentication"""
        self.logger.warning(json.dumps({
            "event": "authentication_failure",
            "timestamp": datetime.now().isoformat(),
            "request_id": request_id,
            "client_ip": client_ip,
            "endpoint": endpoint,
            "reason": reason
        }))
    
    def log_rate_limit_exceeded(self, request_id: str, identifier: str, client_ip: str, endpoint: str):
        """Log rate limit exceeded"""
        self.logger.warning(json.dumps({
            "event": "rate_limit_exceeded",
            "timestamp": datetime.now().isoformat(),
            "request_id": request_id,
            "identifier": identifier,
            "client_ip": client_ip,
            "endpoint": endpoint
        }))
    
    def log_suspicious_activity(self, request_id: str, client_ip: str, endpoint: str, details: str):
        """Log suspicious activity"""
        self.logger.warning(json.dumps({
            "event": "suspicious_activity",
            "timestamp": datetime.now().isoformat(),
            "request_id": request_id,
            "client_ip": client_ip,
            "endpoint": endpoint,
            "details": details
        }))

# Global security audit logger instance
security_logger = SecurityAuditLogger() 