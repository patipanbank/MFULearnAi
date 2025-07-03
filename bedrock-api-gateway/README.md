# AWS Bedrock API Gateway

Enterprise-grade API Gateway for AWS Bedrock services, designed to provide secure, scalable, and monitored access to AWS Bedrock capabilities across your organization.

## ✨ Features

- **🔐 Authentication & Authorization**: API key-based authentication
- **⚡ Rate Limiting**: Configurable rate limiting per API key
- **📊 Comprehensive Logging**: Structured logging with request/response tracking
- **🔄 Health Monitoring**: Built-in health checks and metrics
- **🐳 Docker Support**: Containerized deployment ready
- **🛡️ Security**: Non-root user, security middleware
- **📈 Scalable**: Async/await architecture with FastAPI

## 🚀 Quick Start

### 1. Environment Setup

Copy the environment template:
```bash
cp .env.example .env
```

Configure your environment variables:
```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key

# API Gateway Configuration
API_KEYS=your-secret-api-key-1,your-secret-api-key-2
```

### 2. Docker Deployment

Basic deployment:
```bash
docker-compose up -d
```

With Redis and MongoDB:
```bash
docker-compose --profile with-redis --profile with-mongodb up -d
```

With Nginx reverse proxy:
```bash
docker-compose --profile with-nginx up -d
```

### 3. Local Development

Install dependencies:
```bash
pip install -r requirements.txt
```

Run the application:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 📋 API Endpoints

### Authentication
All protected endpoints require one of:
- `X-API-Key` header
- `Authorization: Bearer <api-key>` header

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | API Gateway information |
| GET | `/health` | Health check |
| GET | `/api/v1/models` | List available models |
| GET | `/api/v1/bedrock/health` | Bedrock service health |
| POST | `/api/v1/bedrock/converse-stream` | Chat completions (streaming) |
| POST | `/api/v1/bedrock/embeddings/text` | Text embeddings |
| POST | `/api/v1/bedrock/embeddings/text/batch` | Batch text embeddings |
| POST | `/api/v1/bedrock/embeddings/image` | Image embeddings |
| POST | `/api/v1/bedrock/images/generate` | Image generation |

## 🔧 Configuration

### Environment Variables

#### Core Settings
- `APP_ENV`: Application environment (development/production)
- `PORT`: Server port (default: 8000)
- `LOG_LEVEL`: Logging level (debug/info/warning/error)

#### AWS Configuration
- `AWS_REGION`: AWS region for Bedrock
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key
- `AWS_BEDROCK_MODEL_ID`: Default Bedrock model

#### API Gateway Settings
- `API_KEYS`: Comma-separated API keys
- `ALLOWED_ORIGINS`: CORS allowed origins
- `RATE_LIMIT_REQUESTS`: Requests per window (default: 100)
- `RATE_LIMIT_WINDOW`: Rate limit window in seconds (default: 60)

#### Logging Configuration
- `LOG_REQUESTS`: Log incoming requests (default: true)
- `LOG_RESPONSES`: Log outgoing responses (default: false)

#### Optional Services
- `REDIS_URL`: Redis connection for distributed rate limiting
- `MONGODB_URI`: MongoDB connection for usage tracking

## 📊 API Examples

### Text Embeddings
```bash
curl -X POST "http://localhost:8000/api/v1/bedrock/embeddings/text" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, world!",
    "model_id": "amazon.titan-embed-text-v1"
  }'
```

### Chat Completions (Streaming)
```bash
curl -X POST "http://localhost:8000/api/v1/bedrock/converse-stream" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "model_id": "anthropic.claude-3-5-sonnet-20240620-v1:0"
  }'
```

### Image Generation
```bash
curl -X POST "http://localhost:8000/api/v1/bedrock/images/generate" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "A beautiful sunset over mountains",
    "width": 1024,
    "height": 1024,
    "quality": "standard"
  }'
```

## 🛡️ Security Features

### API Key Management
- Multiple API keys support
- Key rotation capabilities
- Secure key validation

### Rate Limiting
- Per-API-key rate limiting
- Configurable limits and windows
- Automatic cleanup of old entries

### Request Logging
- Structured JSON logging
- Request/response tracking
- Security event logging
- Configurable log levels

## 🐳 Docker Configuration

### Basic Deployment
```bash
docker-compose up -d
```

### With All Services
```bash
docker-compose --profile with-redis --profile with-mongodb --profile with-nginx up -d
```

### Environment Variables in Docker
All configuration is done through environment variables in the `docker-compose.yml` file.

## 📈 Monitoring & Observability

### Health Checks
- Application health: `/health`
- Bedrock service health: `/api/v1/bedrock/health`
- Docker health checks built-in

### Logging
- Request/response logging
- Security event logging
- Performance metrics
- Error tracking

### Metrics Headers
Every response includes:
- `X-Request-ID`: Unique request identifier
- `X-Process-Time`: Processing time in seconds
- `X-RateLimit-Limit`: Rate limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Window`: Rate limit window

## 🔒 Security Best Practices

1. **Use Strong API Keys**: Generate cryptographically strong API keys
2. **Rotate Keys Regularly**: Implement key rotation policies
3. **Monitor Usage**: Track API usage and detect anomalies
4. **Use HTTPS**: Always use HTTPS in production
5. **Limit CORS**: Configure specific origins instead of wildcards
6. **Monitor Logs**: Regularly review security logs

### 🔐 SSL/TLS Configuration

For production deployment, enable HTTPS with SSL certificates:

```bash
# Quick SSL setup
chmod +x ssl-setup.sh
./ssl-setup.sh

# Start with SSL proxy
docker-compose --profile with-nginx up -d
```

**Certificate Options:**
- **Development**: Self-signed certificates (automatic)
- **Production**: Let's Encrypt (free, auto-renewing)
- **Enterprise**: Commercial certificates (DigiCert, GlobalSign)

📚 **Detailed SSL Guide**: See [SSL_SETUP_GUIDE.md](SSL_SETUP_GUIDE.md) for complete instructions.

## 📚 Integration Guide

### For Development Teams
1. Obtain API key from administrators
2. Use the API key in `X-API-Key` header
3. Implement proper error handling for rate limits
4. Monitor response headers for rate limit information

### For Operations Teams
1. Deploy using Docker Compose
2. Configure environment variables
3. Set up monitoring and alerting
4. Implement log aggregation
5. Configure backup strategies

## 🔧 Troubleshooting

### Common Issues

#### Authentication Errors
- Check API key format and validity
- Verify API key is included in request headers
- Ensure API key is properly configured in environment

#### Rate Limit Exceeded
- Check rate limit headers in response
- Implement exponential backoff
- Consider requesting higher limits

#### AWS Bedrock Errors
- Verify AWS credentials and permissions
- Check AWS region configuration
- Ensure Bedrock models are available in region

### Debugging

Enable debug logging:
```bash
LOG_LEVEL=debug
LOG_RESPONSES=true
```

Check container logs:
```bash
docker-compose logs -f bedrock-api-gateway
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation

---

**Note**: This API Gateway is designed for enterprise use. Ensure proper security measures are in place before deploying to production. 