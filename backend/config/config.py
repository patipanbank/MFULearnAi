import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List
import pytz

# Determine the environment mode. Default to 'development' if not set.
APP_ENV = os.getenv('APP_ENV', 'development')

# Define which .env files to load based on the mode.
# The root .env is for shared secrets like AWS keys.
env_files_to_load = ['../.env']  # Point to root directory


class Settings(BaseSettings):
    # Add APP_ENV to settings so we can see which mode is active
    APP_ENV: str = APP_ENV

    # Server
    PORT: int = 5000
    LOG_LEVEL: str = "info"
    TIMEZONE: str = "Asia/Bangkok"  # Default timezone for Thailand (UTC+7)

    # Database & Cache
    MONGODB_URI: str = ""
    REDIS_URL: Optional[str] = None

    # Services
    CHROMA_URL: Optional[str] = None # Replaces CHROMA_HOST
    OLLAMA_API_URL: Optional[str] = None
    HUGGINGFACE_API_KEY: Optional[str] = None
    
    # CORS - ใช้ environment variables ตาม APP_ENV
    ALLOWED_ORIGINS: Optional[str] = None

    # JWT
    JWT_SECRET: Optional[str] = "dev"
    JWT_ALGORITHM: Optional[str] = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: Optional[int] = 30

    # Frontend URL - ใช้ environment variables ตาม APP_ENV
    FRONTEND_URL: Optional[str] = None

    # AWS
    AWS_REGION: Optional[str] = None
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_BEDROCK_MODEL_ID: Optional[str] = None
    
    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_ALLOWED_DOMAINS: Optional[str] = None # Comma-separated string

    # SAML Settings
    SAML_SP_ENTITY_ID: Optional[str] = None
    SAML_SP_ACS_URL: Optional[str] = None
    SAML_IDP_SSO_URL: Optional[str] = None
    SAML_IDP_SLO_URL: Optional[str] = None
    SAML_IDP_ENTITY_ID: Optional[str] = None
    SAML_CERTIFICATE: Optional[str] = None
    SAML_IDENTIFIER_FORMAT: Optional[str] = None
    
    model_config = SettingsConfigDict(
        env_file=tuple(env_files_to_load),
        env_file_encoding='utf-8',
        extra='ignore'
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        
        # Override with environment-specific values based on APP_ENV
        if self.APP_ENV == 'development':
            # Development settings - use DEV values from .env
            self.FRONTEND_URL = os.getenv('DEV_FRONTEND_URL')
            self.ALLOWED_ORIGINS = os.getenv('DEV_ALLOWED_ORIGINS')
        else:
            # Production settings - use PROD values from .env
            self.FRONTEND_URL = os.getenv('PROD_FRONTEND_URL')
            self.ALLOWED_ORIGINS = os.getenv('PROD_ALLOWED_ORIGINS')

settings = Settings() 