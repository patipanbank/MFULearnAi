import asyncio
import logging
import logging.config
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from config.config import settings
from middleware.logging import LoggingMiddleware
from middleware.usage_tracking import UsageTrackingMiddleware
from middleware.redis_rate_limit import RedisRateLimitMiddleware, cleanup_memory_rate_limits
from middleware.auth import APIKeyMiddleware
from services.bedrock_service import bedrock_service
from services.usage_tracking_service import usage_tracking_service
from routes.bedrock import router as bedrock_router
from prometheus_fastapi_instrumentator import Instrumentator  # type: ignore

# Configure logging
logging.config.dictConfig(settings.logging_config)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler"""
    logger.info("Starting AWS Bedrock API Gateway")
    
    # Initialize services
    try:
        # Initialize Bedrock service
        await bedrock_service.initialize()
        logger.info("Bedrock service initialized")
        
        # Initialize usage tracking service
        if settings.MONGODB_URI:
            await usage_tracking_service.connect()
            logger.info("Usage tracking service initialized")
        
        # Start background tasks
        rate_limit_middleware = None
        for middleware in app.user_middleware:
            if isinstance(middleware.cls, type) and issubclass(middleware.cls, RedisRateLimitMiddleware):
                rate_limit_middleware = middleware
                break
        
        if rate_limit_middleware and not getattr(rate_limit_middleware.cls, "use_redis", True):
            # Start cleanup task for memory-based rate limiting
            cleanup_task = asyncio.create_task(cleanup_memory_rate_limits(rate_limit_middleware))
            app.state.cleanup_task = cleanup_task
        
        logger.info("Application startup completed")
        
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        raise
    
    yield
    
    # Shutdown
    logger.info("Shutting down AWS Bedrock API Gateway")
    
    # Cancel background tasks
    if hasattr(app.state, 'cleanup_task'):
        app.state.cleanup_task.cancel()
        try:
            await app.state.cleanup_task
        except asyncio.CancelledError:
            pass
    
    logger.info("Application shutdown completed")

def create_app() -> FastAPI:
    """Create FastAPI application"""
    
    # Create FastAPI app
    app = FastAPI(
        title=settings.API_TITLE,
        version=settings.API_VERSION,
        description=settings.API_DESCRIPTION,
        lifespan=lifespan,
        docs_url="/docs" if settings.ENABLE_DOCS else None,
        redoc_url="/redoc" if settings.ENABLE_REDOC else None,
        openapi_url="/openapi.json" if settings.ENABLE_DOCS else None,
    )
    
    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        **settings.cors_config
    )
    
    # Add custom middleware (order matters!)
    app.add_middleware(LoggingMiddleware)
    app.add_middleware(UsageTrackingMiddleware)
    app.add_middleware(RedisRateLimitMiddleware)
    app.add_middleware(APIKeyMiddleware)
    
    # Add routes
    app.include_router(bedrock_router, prefix="/api/v1")

    # Expose Prometheus metrics
    Instrumentator().instrument(app).expose(app, include_in_schema=False, endpoint="/metrics")
    
    # Root endpoint
    @app.get("/")
    async def root():
        """API Gateway information"""
        return {
            "name": settings.API_TITLE,
            "version": settings.API_VERSION,
            "description": settings.API_DESCRIPTION,
            "environment": settings.ENVIRONMENT,
            "docs_url": "/docs" if settings.ENABLE_DOCS else None,
            "health_check": "/health",
            "status": "healthy"
        }
    
    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Comprehensive health check"""
        health_status = {
            "status": "healthy",
            "timestamp": "2024-01-01T00:00:00Z",
            "services": {}
        }
        
        try:
            # Check Bedrock service
            bedrock_health = await bedrock_service.health_check()
            health_status["services"]["bedrock"] = bedrock_health
            
            # Check usage tracking service
            if settings.MONGODB_URI:
                usage_health = await usage_tracking_service.get_health_status()
                health_status["services"]["usage_tracking"] = usage_health
            
            # Check Redis connection (if configured)
            if settings.REDIS_URL:
                try:
                    # This is a simplified check - in production you might want more detailed Redis health check
                    health_status["services"]["redis"] = {
                        "status": "healthy",
                        "connected": True
                    }
                except Exception as e:
                    health_status["services"]["redis"] = {
                        "status": "error",
                        "connected": False,
                        "error": str(e)
                    }
            
            # Overall health status
            all_healthy = all(
                service.get("status") == "healthy" 
                for service in health_status["services"].values()
            )
            
            if not all_healthy:
                health_status["status"] = "degraded"
                return JSONResponse(
                    content=health_status,
                    status_code=503
                )
            
            return health_status
            
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return JSONResponse(
                content={
                    "status": "unhealthy",
                    "error": str(e),
                    "timestamp": "2024-01-01T00:00:00Z"
                },
                status_code=503
            )
    
    # Models endpoint
    @app.get("/api/v1/models")
    async def list_models():
        """List available Bedrock models"""
        try:
            models = await bedrock_service.list_models()
            return {
                "models": models,
                "count": len(models)
            }
        except Exception as e:
            logger.error(f"Error listing models: {e}")
            return JSONResponse(
                content={"error": "Failed to list models", "detail": str(e)},
                status_code=500
            )
    
    # Stats endpoint (protected)
    @app.get("/api/v1/stats")
    async def get_stats(request: Request):
        """Get usage statistics (requires authentication)"""
        try:
            # Get API key from request state (set by auth middleware)
            api_key = getattr(request.state, 'api_key', None)
            if not api_key:
                return JSONResponse(
                    content={"error": "Authentication required"},
                    status_code=401
                )
            
            # Get usage summary
            if settings.MONGODB_URI:
                stats = await usage_tracking_service.get_usage_summary(days=7)
                return {
                    "period": "7_days",
                    "statistics": stats
                }
            else:
                return {
                    "message": "Usage tracking not enabled",
                    "note": "Configure MONGODB_URI to enable usage statistics"
                }
                
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return JSONResponse(
                content={"error": "Failed to get statistics", "detail": str(e)},
                status_code=500
            )
    
    # Error handlers
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """Global exception handler"""
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        
        # Track error if usage tracking is enabled
        if hasattr(request.state, 'request_id'):
            await usage_tracking_service.track_request(
                request_id=request.state.request_id,
                api_key=getattr(request.state, 'api_key', None),
                client_ip=request.client.host if request.client else "unknown",
                method=request.method,
                endpoint=request.url.path,
                path=str(request.url),
                model_id=None,
                service_type="error",
                processing_time=0.0,
                status_code=500,
                success=False,
                error_message=str(exc)
            )
        
        return JSONResponse(
            content={
                "error": "Internal server error",
                "detail": "An unexpected error occurred",
                "request_id": getattr(request.state, 'request_id', None)
            },
            status_code=500
        )
    
    return app

# Create the app
app = create_app()

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD,
        log_level=settings.LOG_LEVEL.lower(),
        workers=1 if settings.RELOAD else settings.MAX_WORKERS
    ) 