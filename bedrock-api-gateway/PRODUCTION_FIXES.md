# Production Setup - Remaining Fixes

## 🔧 Linter Errors ที่ต้องแก้ไข

### 1. **Config.py - Pydantic Issues**
```python
# แก้ไข config/config.py
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List, Optional

class Settings(BaseSettings):
    # API Gateway settings
    API_TITLE: str = "AWS Bedrock API Gateway"
    API_VERSION: str = "1.0.0"
    
    # Server settings
    HOST: str = Field(default="0.0.0.0")
    PORT: int = Field(default=8000)
    
    # Environment
    ENVIRONMENT: str = Field(default="production")
    DEBUG: bool = Field(default=False)
    
    # Security
    API_KEYS: List[str] = Field(default_factory=list)
    SECRET_KEY: str = Field(default="change-this-in-production")
    
    # AWS settings
    AWS_REGION: str = Field(default="us-east-1")
    AWS_ACCESS_KEY_ID: Optional[str] = Field(default=None)
    AWS_SECRET_ACCESS_KEY: Optional[str] = Field(default=None)
    
    # Redis & MongoDB
    REDIS_URL: Optional[str] = Field(default=None)
    MONGODB_URI: Optional[str] = Field(default=None)
    
    # Rate limiting
    RATE_LIMIT_REQUESTS: int = Field(default=100)
    RATE_LIMIT_WINDOW: int = Field(default=60)
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

### 2. **AuthMiddleware - ใช้ existing middleware**
```python
# แก้ไข main.py imports
from middleware.auth import APIKeyMiddleware as AuthMiddleware
# หรือใช้ existing auth middleware
```

### 3. **BedrockService Methods**
```python
# เพิ่มใน services/bedrock_service.py
class BedrockService:
    def __init__(self):
        self.client = None
        self.initialized = False
    
    async def initialize(self):
        """Initialize Bedrock client"""
        try:
            import boto3
            self.client = boto3.client('bedrock', region_name=settings.AWS_REGION)
            self.initialized = True
            logger.info("Bedrock service initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Bedrock: {e}")
            raise
    
    async def list_models(self):
        """List available Bedrock models"""
        if not self.initialized:
            await self.initialize()
        
        try:
            # Mock response - replace with actual Bedrock API call
            return [
                {
                    "modelId": "anthropic.claude-3-5-sonnet-20240620-v1:0",
                    "modelName": "Claude 3.5 Sonnet",
                    "provider": "Anthropic"
                },
                {
                    "modelId": "amazon.titan-embed-text-v1",
                    "modelName": "Titan Text Embeddings",
                    "provider": "Amazon"
                }
            ]
        except Exception as e:
            logger.error(f"Error listing models: {e}")
            return []
    
    async def health_check(self):
        """Check Bedrock service health"""
        try:
            if not self.client:
                return {"status": "unhealthy", "error": "Not initialized"}
            
            # Test connection - replace with actual health check
            return {"status": "healthy", "initialized": self.initialized}
        except Exception as e:
            return {"status": "error", "error": str(e)}

# Global instance
bedrock_service = BedrockService()
```

### 4. **Usage Tracking Service Type Fixes**
```python
# แก้ไข services/usage_tracking_service.py
from typing import Optional, Dict, Any, List

class UsageTrackingService:
    def __init__(self):
        self.client: Optional[AsyncIOMotorClient] = None
        self.database = None
        self.connected = False
        
    async def connect(self):
        """Connect to MongoDB"""
        if not settings.MONGODB_URI:
            logger.warning("MongoDB URI not provided")
            return
            
        try:
            self.client = AsyncIOMotorClient(settings.MONGODB_URI)
            await self.client.admin.command('ping')
            
            # Get database name from URI
            uri_parts = settings.MONGODB_URI.split('/')
            db_name = uri_parts[-1].split('?')[0] if len(uri_parts) > 3 else 'bedrock_gateway'
            self.database = self.client[db_name]
            
            self.connected = True
            logger.info(f"Connected to MongoDB: {db_name}")
        except Exception as e:
            logger.error(f"MongoDB connection failed: {e}")
            self.connected = False
```

### 5. **Redis Rate Limit Type Fixes**
```python
# แก้ไข middleware/redis_rate_limit.py
import redis
from typing import Optional

class RedisRateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.redis_client: Optional[redis.Redis] = None
        self.use_redis = bool(settings.REDIS_URL)
        
    async def _check_rate_limit_redis(self, identifier: str) -> tuple[bool, int, int]:
        """Redis-based rate limiting with proper type checking"""
        if not self.redis_client:
            return False, self.requests_per_minute, int(time.time()) + self.window_seconds
            
        try:
            # Redis operations with type safety
            pipe = self.redis_client.pipeline()
            # ... rest of implementation
        except Exception as e:
            logger.error(f"Redis error: {e}")
            return False, self.requests_per_minute, int(time.time()) + self.window_seconds
```

## 🚀 Production Deployment Steps

### 1. **Fix Linter Errors**
```bash
# Apply the fixes above
# Run linter to verify
mypy bedrock-api-gateway/ --ignore-missing-imports
```

### 2. **Test Services**
```bash
# Test individual components
python -m pytest tests/ -v

# Test API endpoints
curl -X GET http://localhost:8000/health
```

### 3. **Deploy Production**
```bash
# Copy environment template
cp production-env.example .env

# Edit .env with your values
nano .env

# Run deployment script
chmod +x deploy-production.sh
./deploy-production.sh
```

### 4. **Verify Deployment**
```bash
# Check all services
docker-compose -f docker-compose.prod.yml ps

# Test API
curl -H "X-API-Key: your-api-key" http://localhost:8000/api/v1/models

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

## 📊 Production Features Available

✅ **Distributed Rate Limiting** (Redis)
✅ **Usage Tracking** (MongoDB)  
✅ **SSL/TLS Support** (Nginx)
✅ **Monitoring** (Prometheus/Grafana)
✅ **Logging** (Structured JSON)
✅ **Health Checks**
✅ **Auto-scaling Ready**
✅ **Backup & Recovery**

## 🔐 Security Checklist

- [ ] Change default API keys
- [ ] Configure proper SSL certificates  
- [ ] Set strong passwords for Redis/MongoDB
- [ ] Configure firewall rules
- [ ] Enable monitoring alerts
- [ ] Set up log rotation
- [ ] Configure backup schedules
- [ ] Review security headers

## 📈 Monitoring URLs

- **API Gateway**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000

## 🆘 Troubleshooting

### Common Issues:
1. **Redis Connection Failed**: Check Redis URL and credentials
2. **MongoDB Connection Failed**: Verify MongoDB URI format
3. **SSL Certificate Issues**: Use self-signed for testing
4. **Rate Limiting Not Working**: Check Redis connectivity
5. **Usage Tracking Not Saving**: Verify MongoDB permissions

### Debug Commands:
```bash
# Check container logs
docker logs bedrock-api-gateway
docker logs bedrock-redis  
docker logs bedrock-mongodb

# Check Redis connection
docker exec bedrock-redis redis-cli ping

# Check MongoDB connection
docker exec bedrock-mongodb mongosh --eval "db.adminCommand('ping')"

# Test API directly
curl -v http://localhost:8000/health
``` 