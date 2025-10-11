# 🚀 MFULearnAI Deployment Guide

## Architecture Overview

### Production (Kubernetes - Microservices)
```
Frontend → API Gateway (8080) → Microservices
                                  ├─ Auth Service (3000)
                                  ├─ Chat Service (3002)
                                  ├─ Agent Service (3003)
                                  ├─ RAG Service (3004)
                                  ├─ Training Service (3005)
                                  └─ Storage Service (3006)
```

### Development (Docker Compose - Monolith)
```
Frontend → Backend Monolith (3001) → All routes in one service
```

---

## 📋 Prerequisites

### For Production (Kubernetes):
- Kubernetes cluster
- kubectl configured
- Docker installed
- Access to SSH server: `mfulearnai@10.1.44.204`

### For Development (Local):
- Docker & Docker Compose
- Node.js 20+
- Git

---

## 🏭 Production Deployment

### Step 1: SSH to Production Server

```bash
ssh mfulearnai@10.1.44.204
cd MFULearnAi
```

### Step 2: Pull Latest Code

```bash
git fetch origin kubernetes
git pull origin kubernetes
```

### Step 3: Deploy All Services

```bash
# Deploy infrastructure + microservices + API Gateway
./deploy-production.sh
```

Or use the Kubernetes deployment script:

```bash
cd k8s
./deploy-all-services.sh
```

### Step 4: Verify Deployment

```bash
# Check all pods
kubectl get pods --all-namespaces | grep mfulearnai

# Check API Gateway
kubectl get pods -n mfulearnai-gateway
kubectl logs -f deployment/api-gateway -n mfulearnai-gateway

# Check services
kubectl get svc -n mfulearnai-gateway
kubectl get svc -n mfulearnai-services
```

### Step 5: Access the Application

- **Frontend**: https://mfulearnai.mfu.ac.th
- **API Gateway**: https://mfulearnai.mfu.ac.th/api
- **WebSocket**: wss://mfulearnai.mfu.ac.th/ws

---

## 💻 Development Setup

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd MFULearnAi
```

### Step 2: Setup Environment Variables

#### Backend (.env in root):
```bash
cp .env.example .env
# Edit .env with your values
```

#### Frontend:
```bash
cd frontend
cp .env.example .env
# Edit .env (should use http://localhost:3001/api for development)
```

### Step 3: Start Services

```bash
# Start all services (MongoDB, Redis, Backend, Frontend)
docker-compose up -d

# Or start in foreground to see logs
docker-compose up
```

### Step 4: Access Development

- **Frontend**: http://localhost:5173 (Vite dev server)
- **Backend API**: http://localhost:3001/api
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379

### Step 5: Development with Hot Reload

#### Frontend (in `frontend/` directory):
```bash
npm install
npm run dev
```

#### Backend (in `backend/` directory):
```bash
npm install
npm run dev
```

---

## 🔧 Configuration

### Frontend Environment Variables

**Location**: `frontend/.env`

```bash
# Development
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:3001/ws

# Production (set via Docker build args)
VITE_API_URL=https://mfulearnai.mfu.ac.th/api
VITE_WS_URL=wss://mfulearnai.mfu.ac.th/ws
```

### API Gateway Configuration

**Location**: `k8s/gateway/api-gateway/src/config/config.ts`

All microservice URLs are configured via Kubernetes ConfigMaps:
- See `k8s/configmaps.yaml` for service URLs
- See `k8s/gateway/api-gateway/deployment.yaml` for environment variables

### Backend Monolith Configuration

**Location**: Backend `.env`

```bash
PORT=3001
MONGODB_URI=mongodb://root:changeme123@db:27017/mfu_chatbot?authSource=admin
REDIS_URL=redis://redis:6379
JWT_SECRET=your-super-secret-jwt-key
```

---

## 🧪 Testing Routes

### Test API Gateway (Production)

```bash
# Health check
curl https://mfulearnai.mfu.ac.th/health

# Test auth endpoint (should proxy to auth-service)
curl https://mfulearnai.mfu.ac.th/api/auth/status

# Test agents endpoint (should proxy to agent-service)
curl -H "Authorization: Bearer <token>" \
  https://mfulearnai.mfu.ac.th/api/agents
```

### Test Backend Monolith (Development)

```bash
# Health check
curl http://localhost:3001/health

# Test auth endpoint
curl http://localhost:3001/api/auth/status

# Test agents endpoint
curl -H "Authorization: Bearer <token>" \
  http://localhost:3001/api/agents
```

---

## 📊 Monitoring

### View Logs

```bash
# API Gateway logs
kubectl logs -f deployment/api-gateway -n mfulearnai-gateway

# Specific service logs
kubectl logs -f deployment/agent-service -n mfulearnai-services
kubectl logs -f deployment/chat-service -n mfulearnai-services

# Development (Docker Compose)
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Check Service Health

```bash
# Kubernetes
kubectl get pods -n mfulearnai-gateway
kubectl get pods -n mfulearnai-services

# Docker Compose
docker-compose ps
```

---

## 🔄 Update Deployment

### Update Single Service

```bash
# Rebuild and restart specific service
cd k8s/services/agent-service
docker build -t mfulearnai/agent-service:latest .
kubectl rollout restart deployment/agent-service -n mfulearnai-services
```

### Update API Gateway

```bash
cd k8s/gateway/api-gateway
docker build -t mfulearnai/api-gateway:latest .
kubectl rollout restart deployment/api-gateway -n mfulearnai-gateway
```

### Update Frontend

```bash
cd frontend
docker build -t mfulearnai/frontend:latest \
  --build-arg VITE_API_URL=https://mfulearnai.mfu.ac.th/api \
  --build-arg VITE_WS_URL=wss://mfulearnai.mfu.ac.th/ws .
```

---

## 🐛 Troubleshooting

### Frontend Can't Connect to API

**Symptom**: 404 errors on API calls

**Check**:
1. Verify `VITE_API_URL` in frontend config
2. Check if API Gateway is running: `kubectl get pods -n mfulearnai-gateway`
3. Check API Gateway logs for errors
4. Verify ingress routing

### WebSocket Connection Failed

**Symptom**: WebSocket disconnects immediately

**Check**:
1. Verify `VITE_WS_URL` matches API URL protocol
2. Check Chat Service is running
3. Verify API Gateway WebSocket proxy config
4. Check CORS settings

### Service Returns 502 Bad Gateway

**Symptom**: API Gateway returns 502

**Check**:
1. Verify target microservice is running
2. Check service DNS resolution
3. Verify service ports match ConfigMap
4. Check microservice logs

### Database Connection Issues

**Symptom**: Services can't connect to MongoDB

**Check**:
1. Verify MongoDB pod is running
2. Check MongoDB credentials in secrets
3. Verify MONGODB_URI environment variable
4. Test connection: `kubectl exec -it <pod> -- mongosh`

---

## 📞 Support

For issues or questions:
1. Check logs first (see Monitoring section)
2. Verify configuration matches this guide
3. Review error messages in pod logs
4. Check Kubernetes events: `kubectl get events -n <namespace>`

---

## 🔐 Security Notes

**IMPORTANT**: Before production deployment:

1. Change all default secrets:
   - JWT_SECRET
   - MongoDB passwords
   - Redis password (if enabled)
   - Session secrets

2. Update secrets in:
   - `k8s/secrets-template.yaml`
   - `.env` files
   - Kubernetes secrets

3. Enable HTTPS:
   - Configure ingress with TLS
   - Update CORS settings
   - Update frontend URLs to use `https://` and `wss://`

4. Review security settings:
   - API Gateway rate limits
   - CORS allowed origins
   - Network policies
   - Pod security policies
