# MFU Learn AI

## 🚀 Project Overview

MFU Learn AI เป็นระบบการเรียนรู้ด้วย AI ที่พัฒนาโดย Maejo University ประกอบด้วยส่วนประกอบหลัก:

### 🏗️ Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│     Frontend        │    │     Backend         │    │  Bedrock Gateway    │
│   (React + Vite)    │◄──►│  (FastAPI + ML)     │◄──►│  (Production API)   │
│                     │    │                     │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
           │                          │                          │
           │                          │                          │
           ▼                          ▼                          ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│    User Interface   │    │    Data Storage     │    │   AWS Bedrock       │
│  - Chat Interface   │    │  - MongoDB          │    │  - Claude 3.5       │
│  - Agent Management │    │  - Redis            │    │  - Embeddings       │
│  - Knowledge Base   │    │  - ChromaDB         │    │  - Image Generation │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

## 🔧 Components

### 1. **Frontend Application**
- **Technology**: React + TypeScript + Vite
- **Features**: 
  - Modern chat interface
  - Agent management system
  - Knowledge base management
  - Real-time streaming responses
  - Multi-language support

### 2. **Backend API**
- **Technology**: FastAPI + Python
- **Features**:
  - RESTful API endpoints
  - WebSocket support for real-time chat
  - Agent orchestration
  - Document processing and embedding
  - User management and authentication

### 3. **AWS Bedrock API Gateway** ⭐ **NEW**
- **Technology**: FastAPI + Redis + MongoDB
- **Features**:
  - **Production-ready API Gateway** for AWS Bedrock services
  - **Distributed rate limiting** with Redis
  - **Comprehensive usage tracking** with MongoDB
  - **Enterprise security** with API key management
  - **SSL/TLS support** with Nginx reverse proxy
  - **Monitoring and alerting** with Prometheus/Grafana
  - **Auto-scaling** and load balancing ready

## 🆕 AWS Bedrock API Gateway

### Enterprise Features
- ✅ **Production-Ready**: Integrated with main docker-compose
- ✅ **Distributed Rate Limiting**: Redis-based rate limiting across multiple instances
- ✅ **Usage Analytics**: Comprehensive MongoDB-based usage tracking
- ✅ **Security**: API key authentication, SSL/TLS, security headers
- ✅ **Monitoring**: Health checks, metrics, logging, alerting
- ✅ **Scalability**: Docker Swarm/Kubernetes ready
- ✅ **High Availability**: Multi-container deployment with failover

### Configuration

#### Environment Variables
```bash
# Copy and configure environment
cp bedrock-env.example .env

# Required AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20240620-v1:0

# Bedrock Gateway Configuration
BEDROCK_SECRET_KEY=your-super-secret-key-change-in-production
BEDROCK_API_KEYS=api-key-1,api-key-2,api-key-3
BEDROCK_ALLOWED_ORIGINS=*
BEDROCK_RATE_LIMIT_REQUESTS=100
BEDROCK_RATE_LIMIT_WINDOW=60
```

#### Generate API Keys
```bash
# Generate secure API keys
python generate_bedrock_keys.py
```

### Services Integration
- **API Gateway**: FastAPI application with advanced middleware
- **Redis**: Shared with main system for distributed caching and rate limiting
- **MongoDB**: Shared with main system for usage tracking and analytics
- **Port**: 8001 (external) -> 8000 (internal) to avoid conflict with ChromaDB

### API Endpoints
```
GET    /                           - Gateway information
GET    /health                     - Health check
GET    /api/v1/models              - List available models
POST   /api/v1/bedrock/converse-stream - Chat completions
POST   /api/v1/bedrock/embeddings/text - Text embeddings
POST   /api/v1/bedrock/embeddings/image - Image embeddings
POST   /api/v1/bedrock/images/generate - Image generation
```

### Usage Examples
```bash
# Test the gateway
curl -X GET http://localhost:8001/health

# Chat completion with API key
curl -X POST http://localhost:8001/api/v1/bedrock/converse-stream \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "Hello!"}]}'
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for frontend development)
- Python 3.11+ (for backend development)
- AWS Account with Bedrock access

### Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/MFULearnAi.git
cd MFULearnAi

# Start development environment
docker-compose up -d

# Frontend development
cd frontend
npm install
npm run dev

# Backend development
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Production Deployment

#### Option 1: Full Stack with Bedrock Gateway (Recommended)
```bash
# Configure environment for Bedrock Gateway
cp bedrock-env.example .env
# Edit .env with your AWS credentials and API keys

# Deploy all services including Bedrock Gateway
docker-compose up -d

# Bedrock Gateway will be available at:
# - External: http://localhost:8001
# - Internal: http://bedrock-gateway:8000
```

#### Option 2: Development Environment
```bash
# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Deploy development services
docker-compose up -d
```

## 🛠️ Development

### Project Structure
```
MFULearnAi/
├── frontend/                 # React frontend application
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API services
│   │   └── utils/          # Utility functions
│   └── package.json
├── backend/                 # FastAPI backend
│   ├── routes/             # API routes
│   ├── services/           # Business logic
│   ├── models/             # Data models
│   └── main.py
├── bedrock-api-gateway/     # Production API Gateway
│   ├── middleware/         # Custom middleware
│   ├── services/           # Service implementations
│   ├── models/             # Data models
│   └── generate_api_keys.py
├── docker-compose.yml       # Main docker-compose (includes Bedrock Gateway)
├── bedrock-env.example      # Bedrock Gateway environment template
└── monitoring/              # Prometheus & Grafana configuration
```

### Key Technologies
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: FastAPI, Python, Asyncio
- **Database**: MongoDB, Redis, ChromaDB
- **AI/ML**: AWS Bedrock, LangChain, OpenAI
- **DevOps**: Docker, Nginx, Prometheus, Grafana
- **Security**: JWT, API Keys, SSL/TLS

## 📊 Features

### Core Features
- **Multi-Modal AI Chat**: Support for text, images, and documents
- **Agent Management**: Create and manage AI agents with specific roles
- **Knowledge Base**: Upload and manage documents for RAG (Retrieval-Augmented Generation)
- **Real-time Streaming**: WebSocket-based streaming responses
- **User Management**: Authentication and authorization
- **Multi-language Support**: Thai and English interface

### Advanced Features
- **Custom Agents**: Create specialized AI agents for different use cases
- **Document Processing**: Automatic text extraction and chunking
- **Vector Search**: Semantic search across knowledge base
- **Usage Analytics**: Track API usage and performance metrics
- **Rate Limiting**: Prevent abuse and manage resource usage
- **Monitoring**: Real-time system monitoring and alerting

## 🔧 Configuration

### Environment Variables
```bash
# API Configuration
API_KEYS=your-api-keys-comma-separated
SECRET_KEY=your-secret-key

# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key

# Database Configuration
MONGODB_URI=mongodb://localhost:27017
REDIS_URL=redis://localhost:6379

# Security
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60
```

### Docker Compose Profiles
```bash
# Development
docker-compose up -d

# Production with monitoring
docker-compose -f docker-compose.prod.yml --profile monitoring up -d

# Production with logging
docker-compose -f docker-compose.prod.yml --profile logging up -d
```

## 📈 Monitoring

### Health Checks
```bash
# Check API Gateway health
curl http://localhost:8000/health

# Check all services
docker-compose -f docker-compose.prod.yml ps
```

### Metrics
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000
- **API Metrics**: http://localhost:8000/metrics

### Logs
```bash
# View all logs
docker-compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker-compose -f docker-compose.prod.yml logs -f bedrock-api-gateway
```

## 🔒 Security

### Production Security Checklist
- [ ] Change default API keys and secrets
- [ ] Configure proper SSL certificates
- [ ] Set up firewall rules
- [ ] Enable security headers
- [ ] Configure rate limiting
- [ ] Set up monitoring and alerting
- [ ] Regular security updates
- [ ] Backup and recovery procedures

### Security Features
- **API Key Authentication**: Secure access control
- **Rate Limiting**: Prevent abuse and DoS attacks
- **SSL/TLS**: Encrypted communication
- **Security Headers**: HSTS, CSP, X-Frame-Options
- **Input Validation**: Prevent injection attacks
- **Logging**: Comprehensive audit trail

## 🚀 Deployment

### Production Deployment Options

#### 1. Docker Compose (Recommended for single server)
```bash
./deploy-production.sh
```

#### 2. Kubernetes (For enterprise/multi-server)
```bash
# Coming soon - K8s manifests
kubectl apply -f k8s/
```

#### 3. AWS ECS/EKS
```bash
# Coming soon - AWS deployment templates
```

### Scaling
- **Horizontal Scaling**: Add more API Gateway instances
- **Database Scaling**: MongoDB replica sets, Redis cluster
- **Load Balancing**: Nginx with multiple upstream servers
- **Auto-scaling**: Based on CPU/memory usage

## 📚 Documentation

### API Documentation
- **OpenAPI/Swagger**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

### Additional Resources
- [AWS Bedrock API Gateway Documentation](./bedrock-api-gateway/README.md)
- [SSL Setup Guide](./bedrock-api-gateway/SSL_SETUP_GUIDE.md)
- [Frontend Development Guide](./frontend/README.md)
- [Backend API Documentation](./backend/README.md)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Maejo University for project sponsorship
- AWS for Bedrock AI services
- OpenAI for GPT models
- The open-source community for excellent tools and libraries

## 📞 Support

For support and questions:
- 📧 Email: support@mfu.ac.th
- 💬 Discord: [MFU Learn AI Community](https://discord.gg/mfu-learn-ai)
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/MFULearnAi/issues)

---

**Made with ❤️ by Maejo University** 
