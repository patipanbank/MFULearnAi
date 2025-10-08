from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId
import json

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid ObjectId")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")
        return field_schema

class UsageRecord(BaseModel):
    """Model for API usage tracking"""
    
    model_config = ConfigDict(
        validate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    # Request identification
    request_id: str = Field(..., description="Unique request identifier")
    api_key: Optional[str] = Field(None, description="API key used (masked)")
    client_ip: str = Field(..., description="Client IP address")
    user_agent: Optional[str] = Field(None, description="User agent string")
    
    # Request details
    method: str = Field(..., description="HTTP method")
    endpoint: str = Field(..., description="API endpoint")
    path: str = Field(..., description="Full request path")
    query_params: Optional[Dict[str, Any]] = Field(None, description="Query parameters")
    
    # AWS Bedrock details
    model_id: Optional[str] = Field(None, description="Bedrock model used")
    service_type: str = Field(..., description="Service type (chat, embeddings, image)")
    
    # Request/Response data
    request_size: int = Field(0, description="Request size in bytes")
    response_size: int = Field(0, description="Response size in bytes")
    
    # Performance metrics
    processing_time: float = Field(..., description="Processing time in seconds")
    status_code: int = Field(..., description="HTTP status code")
    
    # Timing
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Additional metadata
    success: bool = Field(True, description="Request success status")
    error_message: Optional[str] = Field(None, description="Error message if failed")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")

class ApiKeyUsage(BaseModel):
    """Model for API key usage statistics"""
    
    model_config = ConfigDict(
        validate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    # API key details
    api_key: str = Field(..., description="API key (masked)")
    api_key_hash: str = Field(..., description="Hashed API key for tracking")
    
    # Usage statistics
    total_requests: int = Field(0, description="Total number of requests")
    successful_requests: int = Field(0, description="Number of successful requests")
    failed_requests: int = Field(0, description="Number of failed requests")
    
    # Data transfer
    total_request_size: int = Field(0, description="Total request data in bytes")
    total_response_size: int = Field(0, description="Total response data in bytes")
    
    # Service usage breakdown
    chat_requests: int = Field(0, description="Number of chat requests")
    embedding_requests: int = Field(0, description="Number of embedding requests")
    image_requests: int = Field(0, description="Number of image requests")
    
    # Performance metrics
    avg_processing_time: float = Field(0.0, description="Average processing time")
    max_processing_time: float = Field(0.0, description="Maximum processing time")
    min_processing_time: float = Field(0.0, description="Minimum processing time")
    
    # Rate limiting stats
    rate_limit_hits: int = Field(0, description="Number of rate limit violations")
    
    # Time periods
    first_request: Optional[datetime] = Field(None, description="First request timestamp")
    last_request: Optional[datetime] = Field(None, description="Last request timestamp")
    
    # Daily usage (last 30 days)
    daily_usage: List[Dict[str, Any]] = Field(default_factory=list, description="Daily usage breakdown")
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DailyUsageStats(BaseModel):
    """Model for daily usage statistics"""
    
    model_config = ConfigDict(
        validate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    # Date and identification
    date: str = Field(..., description="Date in YYYY-MM-DD format")
    api_key: Optional[str] = Field(None, description="API key (if specific to key)")
    
    # Request counts
    total_requests: int = Field(0, description="Total requests for the day")
    successful_requests: int = Field(0, description="Successful requests")
    failed_requests: int = Field(0, description="Failed requests")
    
    # Service breakdown
    chat_requests: int = Field(0, description="Chat service requests")
    embedding_requests: int = Field(0, description="Embedding service requests")
    image_requests: int = Field(0, description="Image service requests")
    
    # Data transfer
    total_request_size: int = Field(0, description="Total request data in bytes")
    total_response_size: int = Field(0, description="Total response data in bytes")
    
    # Performance
    avg_processing_time: float = Field(0.0, description="Average processing time")
    max_processing_time: float = Field(0.0, description="Maximum processing time")
    
    # Rate limiting
    rate_limit_hits: int = Field(0, description="Rate limit violations")
    
    # Unique clients
    unique_clients: int = Field(0, description="Number of unique client IPs")
    unique_api_keys: int = Field(0, description="Number of unique API keys")
    
    # Error breakdown
    error_counts: Dict[str, int] = Field(default_factory=dict, description="Error counts by type")
    status_code_counts: Dict[str, int] = Field(default_factory=dict, description="Status code distribution")
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SystemMetrics(BaseModel):
    """Model for system-wide metrics"""
    
    model_config = ConfigDict(
        validate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    
    # Time period
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    period_start: datetime = Field(..., description="Start of measurement period")
    period_end: datetime = Field(..., description="End of measurement period")
    
    # System performance
    avg_response_time: float = Field(0.0, description="Average response time")
    requests_per_second: float = Field(0.0, description="Requests per second")
    error_rate: float = Field(0.0, description="Error rate percentage")
    
    # Resource usage
    cpu_usage: Optional[float] = Field(None, description="CPU usage percentage")
    memory_usage: Optional[float] = Field(None, description="Memory usage percentage")
    disk_usage: Optional[float] = Field(None, description="Disk usage percentage")
    
    # API Gateway specific
    active_api_keys: int = Field(0, description="Number of active API keys")
    total_endpoints_hit: int = Field(0, description="Number of different endpoints used")
    
    # Redis metrics (if available)
    redis_connected: bool = Field(False, description="Redis connection status")
    redis_memory_usage: Optional[int] = Field(None, description="Redis memory usage in bytes")
    
    # MongoDB metrics
    mongodb_connected: bool = Field(False, description="MongoDB connection status")
    
    # Rate limiting stats
    total_rate_limit_hits: int = Field(0, description="Total rate limit violations") 