# pyright: ignore-all

import os
from pydantic_settings import BaseSettings
from pydantic import Field as _PydanticField, field_validator
from typing import List, Optional, Any

# ---- Type-checker shim ----
# The official stubs for pydantic v2 do not include the `env` kwarg accepted by
# pydantic-settings' Field.  Redeclare a thin wrapper so static analyzers stop
# flagging every usage while runtime behaviour remains the same.

def Field(*args: Any, **kwargs: Any):  # type: ignore[override]
    return _PydanticField(*args, **kwargs)

class Settings(BaseSettings):  # type: ignore[misc]
    # API Gateway settings
    API_TITLE: str = "AWS Bedrock API Gateway"
    API_VERSION: str = "1.0.0"
    API_DESCRIPTION: str = "Production-ready API Gateway for AWS Bedrock services"
    
    # Server settings
    HOST: str = Field(default="0.0.0.0", env="HOST")
    PORT: int = Field(default=8000, env="PORT")
    RELOAD: bool = Field(default=False, env="RELOAD")
    
    # Environment
    ENVIRONMENT: str = Field(default="production", env="ENVIRONMENT")
    DEBUG: bool = Field(default=False, env="DEBUG")
    
    # Security
    API_KEYS: str = Field(default="mfu-web-app-2024-secure-key,mfu-mobile-app-2024-secure-key,mfu-admin-panel-2024-secure-key,mfu-partner-api-2024-secure-key", env="API_KEYS")
    SECRET_KEY: str = Field(default="mfu-learn-ai-secret-key-2024-change-in-production", env="SECRET_KEY")
    
    # CORS settings
    CORS_ORIGINS: List[str] = Field(default=["*"], env="CORS_ORIGINS")
    CORS_METHODS: List[str] = Field(default=["GET", "POST", "PUT", "DELETE", "OPTIONS"], env="CORS_METHODS")
    CORS_HEADERS: List[str] = Field(default=["*"], env="CORS_HEADERS")
    
    # AWS Bedrock settings
    AWS_REGION: str = Field(default="us-east-1", env="AWS_REGION")
    AWS_ACCESS_KEY_ID: Optional[str] = Field(default=None, env="AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY: Optional[str] = Field(default=None, env="AWS_SECRET_ACCESS_KEY")
    AWS_SESSION_TOKEN: Optional[str] = Field(default=None, env="AWS_SESSION_TOKEN")
    
    # Rate limiting settings
    RATE_LIMIT_REQUESTS: int = Field(default=100, env="RATE_LIMIT_REQUESTS")
    RATE_LIMIT_WINDOW: int = Field(default=60, env="RATE_LIMIT_WINDOW")  # seconds
    
    # Redis settings (for distributed rate limiting)
    REDIS_URL: Optional[str] = Field(default=None, env="REDIS_URL")
    REDIS_PASSWORD: Optional[str] = Field(default=None, env="REDIS_PASSWORD")
    REDIS_DB: int = Field(default=0, env="REDIS_DB")
    REDIS_MAX_CONNECTIONS: int = Field(default=10, env="REDIS_MAX_CONNECTIONS")
    
    # MongoDB settings (for usage tracking)
    MONGODB_URI: Optional[str] = Field(default=None, env="MONGODB_URI")
    MONGODB_DATABASE: str = Field(default="bedrock_gateway", env="MONGODB_DATABASE")
    MONGODB_MAX_CONNECTIONS: int = Field(default=10, env="MONGODB_MAX_CONNECTIONS")
    
    # Logging settings
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    LOG_FORMAT: str = Field(default="json", env="LOG_FORMAT")  # json or text
    LOG_FILE: Optional[str] = Field(default=None, env="LOG_FILE")
    LOG_REQUESTS: bool = Field(default=True, env="LOG_REQUESTS")
    LOG_RESPONSES: bool = Field(default=True, env="LOG_RESPONSES")
    
    # Monitoring settings
    ENABLE_METRICS: bool = Field(default=True, env="ENABLE_METRICS")
    METRICS_PORT: int = Field(default=8001, env="METRICS_PORT")
    
    # Health check settings
    HEALTH_CHECK_INTERVAL: int = Field(default=30, env="HEALTH_CHECK_INTERVAL")  # seconds
    
    # Request timeout settings
    REQUEST_TIMEOUT: int = Field(default=300, env="REQUEST_TIMEOUT")  # seconds
    
    # Data retention settings
    USAGE_DATA_RETENTION_DAYS: int = Field(default=90, env="USAGE_DATA_RETENTION_DAYS")
    
    # Performance settings
    MAX_WORKERS: int = Field(default=4, env="MAX_WORKERS")
    WORKER_CONNECTIONS: int = Field(default=1000, env="WORKER_CONNECTIONS")
    
    # SSL/TLS settings
    SSL_CERT_PATH: Optional[str] = Field(default=None, env="SSL_CERT_PATH")
    SSL_KEY_PATH: Optional[str] = Field(default=None, env="SSL_KEY_PATH")
    
    # Nginx settings
    NGINX_ENABLED: bool = Field(default=False, env="NGINX_ENABLED")
    NGINX_HOST: str = Field(default="nginx", env="NGINX_HOST")
    NGINX_PORT: int = Field(default=80, env="NGINX_PORT")
    
    # Development settings
    ENABLE_DOCS: bool = Field(default=True, env="ENABLE_DOCS")
    ENABLE_REDOC: bool = Field(default=True, env="ENABLE_REDOC")
    
    @field_validator('CORS_ORIGINS', 'CORS_METHODS', 'CORS_HEADERS', mode='before')
    @classmethod
    def parse_comma_separated(cls, v):
        try:
            if v is None:
                return []
            if isinstance(v, str):
                if not v.strip():
                    return []
                return [item.strip() for item in v.split(",") if item.strip()]
            return v
        except Exception:
            # Fallback to empty list if parsing fails
            return []
    
    model_config = {
        "env_file": ("../.env", ".env"),
        "case_sensitive": True,
        "extra": "ignore"
    }
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Parse CORS origins if provided as string
        if isinstance(self.CORS_ORIGINS, str):
            self.CORS_ORIGINS = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        
        # Validate required settings for production
        if self.ENVIRONMENT == "production":
            self._validate_production_settings()
    
    def _validate_production_settings(self):
        """Validate required settings for production environment"""
        errors = []
        
        # Check API keys
        if not self.API_KEYS or not self.API_KEYS.strip():
            errors.append("API_KEYS must be provided in production")
        
        # Check AWS credentials
        if not self.AWS_ACCESS_KEY_ID or not self.AWS_SECRET_ACCESS_KEY:
            errors.append("AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) must be provided")
        
        # Check secret key
        if self.SECRET_KEY == "your-secret-key-change-this":
            errors.append("SECRET_KEY must be changed from default value")
        
        # Production-specific warnings
        if self.DEBUG:
            print("WARNING: DEBUG is enabled in production")
        
        if self.RELOAD:
            print("WARNING: RELOAD is enabled in production")
        
        if errors:
            raise ValueError(f"Production configuration errors: {'; '.join(errors)}")
    
    @property
    def is_production(self) -> bool:
        """Check if running in production environment"""
        return self.ENVIRONMENT.lower() == "production"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development environment"""
        return self.ENVIRONMENT.lower() in ["development", "dev", "local"]
    
    @property
    def redis_config(self) -> dict:
        """Get Redis configuration"""
        if not self.REDIS_URL:
            return {}
        
        config = {
            "url": self.REDIS_URL,
            "db": self.REDIS_DB,
            "max_connections": self.REDIS_MAX_CONNECTIONS,
            "decode_responses": True,
            "socket_connect_timeout": 5,
            "socket_timeout": 5,
            "retry_on_timeout": True,
            "health_check_interval": 30
        }
        
        if self.REDIS_PASSWORD:
            config["password"] = self.REDIS_PASSWORD
        
        return config
    
    @property
    def mongodb_config(self) -> dict:
        """Get MongoDB configuration"""
        if not self.MONGODB_URI:
            return {}
        
        return {
            "uri": self.MONGODB_URI,
            "database": self.MONGODB_DATABASE,
            "maxPoolSize": self.MONGODB_MAX_CONNECTIONS,
            "minPoolSize": 1,
            "serverSelectionTimeoutMS": 5000,
            "connectTimeoutMS": 10000,
            "socketTimeoutMS": 0
        }
    
    @property
    def cors_config(self) -> dict:
        """Get CORS configuration"""
        return {
            "allow_origins": self.CORS_ORIGINS,
            "allow_methods": self.CORS_METHODS,
            "allow_headers": self.CORS_HEADERS,
            "allow_credentials": True,
            "expose_headers": ["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining", "X-RateLimit-Reset"]
        }
    
    @property
    def logging_config(self) -> dict:
        """Get logging configuration"""
        config = {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "json": {
                    "class": "pythonjsonlogger.jsonlogger.JsonFormatter",
                    "format": "%(asctime)s %(name)s %(levelname)s %(message)s"
                },
                "text": {
                    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": self.LOG_FORMAT,
                    "level": self.LOG_LEVEL
                }
            },
            "loggers": {
                "": {
                    "handlers": ["console"],
                    "level": self.LOG_LEVEL,
                    "propagate": False
                }
            }
        }
        
        # Add file handler if specified
        if self.LOG_FILE:
            config["handlers"]["file"] = {
                "class": "logging.handlers.RotatingFileHandler",
                "filename": self.LOG_FILE,
                "maxBytes": 10485760,  # 10MB
                "backupCount": 5,
                "formatter": self.LOG_FORMAT,
                "level": self.LOG_LEVEL
            }
            config["loggers"][""]["handlers"].append("file")
        
        return config

# Global settings instance
settings = Settings() 