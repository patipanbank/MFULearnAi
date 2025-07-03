import time
import logging
import uuid
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Callable, Optional
import json

from services.usage_tracking_service import usage_tracking_service

logger = logging.getLogger(__name__)

class UsageTrackingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to track API usage and store in MongoDB
    """
    
    def __init__(self, app):
        super().__init__(app)
        self.excluded_paths = {
            "/", "/docs", "/redoc", "/openapi.json", "/health", "/favicon.ico"
        }
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip tracking for excluded paths
        if request.url.path in self.excluded_paths:
            return await call_next(request)
        
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id
        
        # Start timing
        start_time = time.time()
        
        # Get request details
        api_key = getattr(request.state, 'api_key', None)
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get('User-Agent')
        
        # Calculate request size
        request_size = self._calculate_request_size(request)
        
        # Process request
        response = await call_next(request)
        
        # Calculate processing time
        processing_time = time.time() - start_time
        
        # Get response details
        response_size = self._calculate_response_size(response)
        
        # Extract service information
        service_type = self._extract_service_type(request.url.path)
        model_id = self._extract_model_id(request)
        
        # Determine success status
        success = 200 <= response.status_code < 400
        
        # Track the request asynchronously
        await usage_tracking_service.track_request(
            request_id=request_id,
            api_key=api_key,
            client_ip=client_ip,
            method=request.method,
            endpoint=request.url.path,
            path=str(request.url),
            model_id=model_id,
            service_type=service_type,
            processing_time=processing_time,
            status_code=response.status_code,
            request_size=request_size,
            response_size=response_size,
            user_agent=user_agent,
            query_params=dict(request.query_params) if request.query_params else None,
            success=success,
            error_message=None if success else f"HTTP {response.status_code}",
            metadata={
                "request_id": request_id,
                "method": request.method,
                "headers": dict(request.headers) if hasattr(request, 'headers') else None
            }
        )
        
        # Add request ID to response headers
        response.headers["X-Request-ID"] = request_id
        
        return response
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address"""
        # Check for forwarded headers (from load balancer/proxy)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            # Take the first IP in the chain
            return forwarded_for.split(",")[0].strip()
        
        # Check for real IP header
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        # Fallback to client host
        return request.client.host if request.client else "unknown"
    
    def _calculate_request_size(self, request: Request) -> int:
        """Calculate approximate request size"""
        try:
            # Headers size
            headers_size = sum(len(k) + len(v) for k, v in request.headers.items())
            
            # URL size
            url_size = len(str(request.url))
            
            # Body size (if available)
            body_size = 0
            content_length = request.headers.get("content-length")
            if content_length:
                body_size = int(content_length)
            
            return headers_size + url_size + body_size
            
        except Exception as e:
            logger.warning(f"Error calculating request size: {e}")
            return 0
    
    def _calculate_response_size(self, response: Response) -> int:
        """Calculate approximate response size"""
        try:
            # Headers size
            headers_size = sum(len(k) + len(v) for k, v in response.headers.items())
            
            # Content size
            content_size = 0
            content_length = response.headers.get("content-length")
            if content_length:
                content_size = int(content_length)
            
            return headers_size + content_size
            
        except Exception as e:
            logger.warning(f"Error calculating response size: {e}")
            return 0
    
    def _extract_service_type(self, path: str) -> str:
        """Extract service type from request path"""
        if "/chat" in path or "/converse" in path:
            return "chat"
        elif "/embeddings" in path:
            return "embeddings"
        elif "/images" in path:
            return "image"
        elif "/models" in path:
            return "models"
        else:
            return "other"
    
    def _extract_model_id(self, request: Request) -> Optional[str]:
        """Extract model ID from request"""
        try:
            # Check query parameters
            model_id = request.query_params.get("model_id")
            if model_id:
                return model_id
            
            # For POST requests, we might need to parse the body
            # This is a simplified approach - in practice you might want to
            # parse the actual request body based on content type
            return None
            
        except Exception as e:
            logger.warning(f"Error extracting model ID: {e}")
            return None 