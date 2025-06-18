import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

# Determine the environment mode. Default to 'development' if not set.
APP_ENV = os.getenv('APP_ENV', 'development')

# Define which .env files to load based on the mode.
# The root .env is for shared secrets like AWS keys.
env_files_to_load = ['.env'] 


class Settings(BaseSettings):
    # Add APP_ENV to settings so we can see which mode is active
    APP_ENV: str = APP_ENV

    # Server
    PORT: int = 5000
    LOG_LEVEL: str = "info"

    # Database & Cache
    MONGODB_URI: str = ""
    REDIS_URL: Optional[str] = None

    # Services
    CHROMA_URL: Optional[str] = None # Replaces CHROMA_HOST
    OLLAMA_API_URL: Optional[str] = None
    HUGGINGFACE_API_KEY: Optional[str] = None
    
    # CORS
    ALLOWED_ORIGINS: Optional[str] = "http://localhost:3000,http://localhost"

    # JWT
    JWT_SECRET: Optional[str] = "default_secret_key_for_development_change_in_production"
    JWT_ALGORITHM: Optional[str] = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: Optional[int] = 30

    # Frontend
    FRONTEND_URL: Optional[str] = "http://localhost:3000"

    # AWS
    AWS_REGION: Optional[str] = None
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    
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

settings = Settings() 