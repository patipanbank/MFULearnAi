# 🔗 MFU Learn AI + Bedrock API Gateway Integration Plan

## 📋 Current State Analysis

### MFU Learn AI System:
- **Frontend**: React + Vite (Port 80/443)
- **Backend**: FastAPI (Port 5000)
- **Database**: MongoDB, Redis, ChromaDB, MinIO
- **Bedrock**: Internal service (`backend/services/bedrock_service.py`)
- **Routes**: `/api/bedrock/converse-stream`, `/api/bedrock/generate-image`

### Bedrock API Gateway:
- **Gateway**: FastAPI (Port 8000)
- **Infrastructure**: Redis (rate limit) + MongoDB (usage tracking)
- **Routes**: `/api/v1/bedrock/*` 
- **Features**: Rate limiting, usage analytics, monitoring

## 🎯 Integration Options

### Option 1: Replace Internal Bedrock Service (Recommended)

#### Architecture:
```
Frontend ──► Backend ──► Bedrock API Gateway ──► AWS Bedrock
   │           │               │
   │           │               ├─► Redis (Rate Limiting)
   │           │               └─► MongoDB (Usage Tracking)
   │           │
   │           ├─► MongoDB (App Data)
   │           ├─► ChromaDB (Vectors)
   │           └─► MinIO (Files)
```

#### Implementation Steps:

1. **Update MFU Learn AI Backend Configuration**
```python
# backend/config/config.py
class Settings(BaseSettings):
    # Add Bedrock API Gateway URL
    BEDROCK_API_GATEWAY_URL: str = "http://bedrock-api-gateway:8000"
    BEDROCK_API_GATEWAY_KEY: str = "your-api-key"
    
    # Keep existing AWS settings for fallback
    AWS_REGION: Optional[str] = None
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
```

2. **Update Bedrock Service to Use API Gateway**
```python
# backend/services/bedrock_service.py
import httpx
from config.config import settings

class BedrockService:
    def __init__(self):
        self.gateway_url = settings.BEDROCK_API_GATEWAY_URL
        self.api_key = settings.BEDROCK_API_GATEWAY_KEY
        self.headers = {
            "X-API-Key": self.api_key,
            "Content-Type": "application/json"
        }

    async def converse_stream(self, model_id: str, messages: List[Dict], 
                            system_prompt: str, **kwargs):
        """Proxy to Bedrock API Gateway"""
        async with httpx.AsyncClient() as client:
            payload = {
                "messages": messages,
                "system_prompt": system_prompt,
                "model_id": model_id,
                **kwargs
            }
            
            async with client.stream(
                "POST",
                f"{self.gateway_url}/api/v1/bedrock/converse-stream",
                json=payload,
                headers=self.headers
            ) as response:
                async for chunk in response.aiter_text():
                    if chunk.startswith("data: "):
                        yield json.loads(chunk[6:])

    async def generate_image(self, prompt: str) -> str:
        """Proxy to Bedrock API Gateway"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.gateway_url}/api/v1/bedrock/images/generate",
                json={"prompt": prompt},
                headers=self.headers
            )
            return response.json()["image"]

    async def create_text_embedding(self, text: str) -> List[float]:
        """Proxy to Bedrock API Gateway"""
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.gateway_url}/api/v1/bedrock/embeddings/text",
                json={"text": text},
                headers=self.headers
            )
            return response.json()["embedding"]
```

3. **Update Docker Compose**
```yaml
# docker-compose.yml
services:
  # Add Bedrock API Gateway service
  bedrock-gateway:
    build:
      context: ./bedrock-api-gateway
      dockerfile: Dockerfile
    environment:
      - ENVIRONMENT=production
      - API_KEYS=${BEDROCK_API_KEYS}
      - AWS_REGION=${AWS_REGION}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      - REDIS_URL=redis://redis:6379/1  # Use different DB
      - MONGODB_URI=mongodb://root:1234@db:27017/bedrock_usage?authSource=admin
    depends_on:
      - db
      - redis
    networks:
      - mfulearnai
    restart: unless-stopped

  # Update backend to connect to gateway
  backend:
    environment:
      - BEDROCK_API_GATEWAY_URL=http://bedrock-gateway:8000
      - BEDROCK_API_GATEWAY_KEY=${BEDROCK_API_KEYS}
      # ... existing environment variables
```

### Option 2: Parallel Deployment

#### Architecture:
```
Frontend ──► Backend (Internal Bedrock) ──► AWS Bedrock
               │
External ──► Bedrock API Gateway ──────────► AWS Bedrock
Clients           │
                  ├─► Redis (Rate Limiting)
                  └─► MongoDB (Usage Tracking)
```

#### Use Cases:
- **Internal Users**: Continue using MFU Learn AI directly
- **External Users**: Use Bedrock API Gateway with rate limiting
- **Organization-wide**: Centralized AWS Bedrock access

### Option 3: Hybrid Approach

#### Architecture:
```
Frontend ──► Backend ──► Router ──┬─► Internal Bedrock ──► AWS Bedrock
                          │        │
                          │        └─► API Gateway ──► AWS Bedrock
                          │                 │
External Clients ─────────┘                 ├─► Redis (Rate Limiting)
                                            └─► MongoDB (Usage Tracking)
```

## 🚀 Recommended Implementation

### Phase 1: Setup API Gateway Infrastructure
```bash
cd bedrock-api-gateway
cp production-env.example .env
# Configure environment variables
./deploy-production.sh
```

### Phase 2: Update MFU Learn AI Backend
```python
# 1. Add API Gateway client to backend
# 2. Update bedrock_service.py to proxy requests
# 3. Add fallback to direct AWS Bedrock if gateway fails
```

### Phase 3: Update Docker Compose
```yaml
# Add bedrock-gateway service to main docker-compose.yml
# Configure networking between services
# Update environment variables
```

### Phase 4: Testing & Migration
```bash
# 1. Test API Gateway independently
# 2. Test MFU Learn AI with API Gateway integration
# 3. Monitor usage and performance
# 4. Gradual migration of traffic
```

## 📊 Benefits of Integration

### For MFU Learn AI:
- ✅ **Enhanced Security**: API key management and rate limiting
- ✅ **Usage Analytics**: Detailed usage tracking and reporting  
- ✅ **Cost Optimization**: Better visibility into AWS costs
- ✅ **Performance Monitoring**: Real-time performance metrics
- ✅ **Scalability**: Distributed rate limiting across instances

### For Organization:
- ✅ **Centralized Access**: Single point for all AWS Bedrock usage
- ✅ **Usage Control**: Rate limiting and quota management
- ✅ **Cost Tracking**: Per-department/project usage tracking
- ✅ **Security Compliance**: Centralized security policies
- ✅ **Multi-Application Support**: Share with other applications

## 🔧 Configuration Examples

### Environment Variables (.env)
```bash
# Bedrock API Gateway
BEDROCK_API_GATEWAY_URL=http://bedrock-gateway:8000
BEDROCK_API_GATEWAY_KEY=mfu-learn-ai-key-001

# Gateway Configuration
BEDROCK_API_KEYS=mfu-learn-ai-key-001,external-client-key-002
REDIS_URL=redis://redis:6379/1
MONGODB_URI=mongodb://root:1234@db:27017/bedrock_usage?authSource=admin

# AWS Credentials (shared)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

### Nginx Configuration Update
```nginx
# Add proxy to API Gateway for external access
location /api/bedrock-gateway/ {
    proxy_pass http://bedrock-gateway:8000/api/v1/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 📈 Monitoring Integration

### Grafana Dashboard
- **MFU Learn AI Metrics**: Application performance, user activity
- **Bedrock Gateway Metrics**: API usage, rate limiting, AWS costs
- **Combined View**: Overall system health and usage patterns

### Health Checks
```python
# Backend health check includes gateway status
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "services": {
            "database": await check_database(),
            "redis": await check_redis(),
            "chroma": await check_chroma(),
            "bedrock_gateway": await check_bedrock_gateway()
        }
    }
```

## 🛡️ Security Considerations

### API Key Management
- **Separate Keys**: Different keys for different applications
- **Key Rotation**: Regular rotation of API keys
- **Permission Levels**: Different rate limits per key

### Network Security
- **Internal Network**: Gateway accessible only within Docker network
- **External Access**: Optional nginx proxy for external clients
- **Firewall Rules**: Restrict external access to specific endpoints

## 📋 Migration Checklist

- [ ] Deploy Bedrock API Gateway infrastructure
- [ ] Configure shared Redis and MongoDB
- [ ] Update MFU Learn AI backend service
- [ ] Test integration with existing functionality
- [ ] Update docker-compose configuration
- [ ] Deploy and test in staging environment
- [ ] Monitor performance and usage
- [ ] Gradual migration of production traffic
- [ ] Update documentation and monitoring
- [ ] Train team on new architecture

## 🔄 Rollback Plan

### Immediate Rollback
```python
# Keep original bedrock_service.py as backup
# Use feature flag to switch between direct and gateway access
USE_BEDROCK_GATEWAY = os.getenv("USE_BEDROCK_GATEWAY", "false")

if USE_BEDROCK_GATEWAY.lower() == "true":
    # Use API Gateway
    response = await gateway_client.converse_stream(...)
else:
    # Use direct AWS Bedrock
    response = await direct_bedrock_client.converse_stream(...)
```

### Gradual Migration
```python
# Route percentage of traffic to gateway
import random

if random.random() < float(os.getenv("GATEWAY_TRAFFIC_PERCENTAGE", "0.0")):
    # Route to API Gateway
else:
    # Route to direct Bedrock
``` 