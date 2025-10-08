# MFULearnAI - Complete Microservices Implementation Guide

## 📋 Overview

เอกสารนี้อธิบายวิธีการแยก monolith backend เป็น microservices แบบสมบูรณ์ พร้อม code ที่ใช้งานได้จริง

## 🎯 What's Already Done

### ✅ Infrastructure & DevOps (100% Complete)
- **Kubernetes Manifests**: ครบทุก component (33 files)
- **Namespaces**: 4 namespaces พร้อม isolation
- **Infrastructure**: MongoDB, Redis, ChromaDB, MinIO พร้อม PVC
- **Monitoring**: Prometheus + Grafana + Exporters
- **Documentation**: 5 comprehensive documents (~1,900 lines)
- **Automation**: deploy.sh, undeploy.sh scripts
- **Kustomize**: Development และ Production overlays

### ⚠️ What Needs Implementation

**6 Microservices** ที่ต้องแยกจาก monolith:
1. Chat Service (Port 3002)
2. Agent Service (Port 3003)
3. RAG Service (Port 3004)
4. Training Service (Port 3005)
5. Storage Service (Port 3006)
6. API Gateway (Port 8080)

## 🏗️ Implementation Strategy

### Step 1: Copy Shared Code

แต่ละ service ต้อง copy code ต่อไปนี้:

```bash
# Shared models
backend/src/models/chat.ts
backend/src/models/agent.ts
backend/src/models/collection.ts
backend/src/models/user.ts

# Shared utilities
backend/src/lib/mongodb.ts
backend/src/lib/redis.ts
backend/src/config/config.ts
backend/src/middleware/auth.ts

# Service-specific code
backend/src/routes/[service].ts
backend/src/services/[service]Service.ts
```

### Step 2: Implement Each Service

## 📦 Service #1: Chat Service

### File Structure
```
k8s-services/chat-service/
├── src/
│   ├── index.ts              # Main entry point
│   ├── config/
│   │   └── config.ts         # Configuration
│   ├── lib/
│   │   ├── mongodb.ts        # MongoDB connection
│   │   └── redis.ts          # Redis connection
│   ├── models/
│   │   ├── chat.ts           # Chat model
│   │   └── user.ts           # User model (for auth)
│   ├── middleware/
│   │   └── auth.ts           # JWT middleware
│   ├── routes/
│   │   └── chat.ts           # Chat routes
│   ├── services/
│   │   ├── chatService.ts    # Chat business logic
│   │   └── websocketService.ts  # WebSocket handling
│   └── utils/
│       └── websocketManager.ts  # WebSocket manager
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

### Key Files to Copy/Adapt

**From backend to chat-service:**
```bash
# Models
cp backend/src/models/chat.ts k8s-services/chat-service/src/models/
cp backend/src/models/user.ts k8s-services/chat-service/src/models/

# Services
cp backend/src/services/chatService.ts k8s-services/chat-service/src/services/
cp backend/src/services/websocketService.ts k8s-services/chat-service/src/services/

# Routes
cp backend/src/routes/chat.ts k8s-services/chat-service/src/routes/

# Utils
cp backend/src/utils/websocketManager.ts k8s-services/chat-service/src/utils/

# Middleware
cp backend/src/middleware/auth.ts k8s-services/chat-service/src/middleware/

# Libraries
cp backend/src/lib/mongodb.ts k8s-services/chat-service/src/lib/
cp backend/src/lib/redis.ts k8s-services/chat-service/src/lib/
cp backend/src/config/config.ts k8s-services/chat-service/src/config/
```

### Modifications Needed

1. **chatService.ts**: แก้ไข service URLs
```typescript
// Before
import { agentService } from './agentService';
import { storageService } from './storageService';

// After
import axios from 'axios';

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://agent-service:3003';
const STORAGE_SERVICE_URL = process.env.STORAGE_SERVICE_URL || 'http://storage-service:3006';

// Replace direct calls with HTTP requests
const agent = await axios.get(`${AGENT_SERVICE_URL}/agents/${agentId}`);
const file = await axios.get(`${STORAGE_SERVICE_URL}/files/${fileUrl}`);
```

2. **index.ts**: Create main entry point
```typescript
import express from 'express';
import { createServer } from 'http';
import { connectDB } from './lib/mongodb';
import { WebSocketService } from './services/websocketService';
import chatRouter from './routes/chat';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use('/api/chat', chatRouter);

// Health checks
app.get('/health', (req, res) => res.json({ status: 'healthy' }));
app.get('/ready', async (req, res) => {
  // Check MongoDB connection
  const dbReady = mongoose.connection.readyState === 1;
  if (dbReady) {
    res.json({ status: 'ready' });
  } else {
    res.status(503).json({ status: 'not ready' });
  }
});

const server = createServer(app);
const wsService = new WebSocketService(server);

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`Chat Service running on port ${PORT}`);
  });
});
```

## 📦 Service #2: Agent Service

### File Structure
```
k8s-services/agent-service/
├── src/
│   ├── index.ts
│   ├── config/
│   ├── lib/
│   ├── models/
│   │   └── agent.ts
│   ├── middleware/
│   ├── routes/
│   │   └── agent.ts
│   ├── services/
│   │   ├── agentService.ts
│   │   ├── agentExecutionService.ts
│   │   └── agentOrchestrationService.ts
│   └── agent/
│       ├── agentFactory.ts
│       ├── llmFactory.ts
│       └── toolRegistry.ts
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

### Files to Copy
```bash
# Models
cp backend/src/models/agent.ts k8s-services/agent-service/src/models/

# Services
cp backend/src/services/agentService.ts k8s-services/agent-service/src/services/
cp backend/src/services/agentExecutionService.ts k8s-services/agent-service/src/services/
cp backend/src/services/agentOrchestrationService.ts k8s-services/agent-service/src/services/

# Agent logic
cp -r backend/src/agent/ k8s-services/agent-service/src/

# Routes
cp backend/src/routes/agent.ts k8s-services/agent-service/src/routes/
```

### Modifications
- Replace direct ChromaDB calls with HTTP calls to RAG Service
- Replace direct Bedrock calls with HTTP calls to Bedrock Gateway
- Add HTTP endpoints for other services to call

## 📦 Service #3: RAG Service

### File Structure
```
k8s-services/rag-service/
├── src/
│   ├── index.ts
│   ├── config/
│   ├── lib/
│   │   └── chromadb.ts
│   ├── models/
│   │   └── collection.ts
│   ├── routes/
│   │   ├── chroma.ts
│   │   └── embedding.ts
│   └── services/
│       ├── chromaService.ts
│       └── embeddingService.ts
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

### Files to Copy
```bash
# Models
cp backend/src/models/collection.ts k8s-services/rag-service/src/models/

# Services
cp backend/src/services/chromaService.ts k8s-services/rag-service/src/services/
cp backend/src/services/embeddingService.ts k8s-services/rag-service/src/services/

# Routes
cp backend/src/routes/chroma.ts k8s-services/rag-service/src/routes/
cp backend/src/routes/embedding.ts k8s-services/rag-service/src/routes/
```

## 📦 Service #4: Training Service

### File Structure
```
k8s-services/training-service/
├── src/
│   ├── index.ts
│   ├── config/
│   ├── lib/
│   ├── models/
│   │   └── trainingHistory.ts
│   ├── routes/
│   │   ├── training.ts
│   │   └── queue.ts
│   └── services/
│       ├── trainingService.ts
│       ├── queueService.ts
│       └── documentService.ts
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

### Files to Copy
```bash
# Models
cp backend/src/models/trainingHistory.ts k8s-services/training-service/src/models/

# Services
cp backend/src/services/trainingService.ts k8s-services/training-service/src/services/
cp backend/src/services/queueService.ts k8s-services/training-service/src/services/
cp backend/src/services/documentService.ts k8s-services/training-service/src/services/

# Routes
cp backend/src/routes/training.ts k8s-services/training-service/src/routes/
cp backend/src/routes/queue.ts k8s-services/training-service/src/routes/
```

## 📦 Service #5: Storage Service

### File Structure
```
k8s-services/storage-service/
├── src/
│   ├── index.ts
│   ├── config/
│   ├── lib/
│   ├── routes/
│   │   └── upload.ts
│   └── services/
│       └── storageService.ts
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

### Files to Copy
```bash
# Services
cp backend/src/services/storageService.ts k8s-services/storage-service/src/services/

# Routes
cp backend/src/routes/upload.ts k8s-services/storage-service/src/routes/
```

## 📦 Service #6: API Gateway

### File Structure
```
k8s-services/api-gateway/
├── src/
│   ├── index.ts
│   ├── config/
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── rateLimit.ts
│   │   └── cors.ts
│   ├── routes/
│   │   └── index.ts
│   └── utils/
│       ├── proxy.ts
│       └── metrics.ts
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

### Main Implementation

**src/index.ts**:
```typescript
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { authenticateJWT } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rateLimit';

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(rateLimitMiddleware);

// Route definitions
const services = {
  auth: 'http://auth-service:3000',
  departments: 'http://department-service:3001',
  chat: 'http://chat-service:3002',
  agents: 'http://agent-service:3003',
  rag: 'http://rag-service:3004',
  training: 'http://training-service:3005',
  storage: 'http://storage-service:3006',
  bedrock: 'http://bedrock-gateway:8000'
};

// Public routes (no auth)
app.use('/api/auth', createProxyMiddleware({
  target: services.auth,
  changeOrigin: true,
  pathRewrite: { '^/api/auth': '/api/auth' }
}));

// Protected routes (with auth)
app.use('/api/chat', authenticateJWT, createProxyMiddleware({
  target: services.chat,
  changeOrigin: true,
  pathRewrite: { '^/api/chat': '/api/chat' },
  ws: true  // WebSocket support
}));

// ... more routes

// WebSocket proxy for chat
app.use('/ws', authenticateJWT, createProxyMiddleware({
  target: services.chat,
  changeOrigin: true,
  ws: true
}));

// Health checks
app.get('/health', (req, res) => res.json({ status: 'healthy' }));
app.get('/ready', (req, res) => res.json({ status: 'ready' }));

app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
```

## 🚀 Deployment Process

### 1. Build Services Locally (Optional Test)
```bash
cd k8s-services/chat-service
npm install
npm run build
```

### 2. On Remote Server (ssh mfulearnai@10.1.44.204)

```bash
# Pull latest code
cd /path/to/MFULearnAi
git pull origin kubernetes

# Build Docker images
cd k8s-services/chat-service
docker build -t your-registry/chat-service:v1.0.0 .
docker push your-registry/chat-service:v1.0.0

# Repeat for all services...

# Update image tags in manifests
cd ../../k8s
find . -name "deployment.yaml" -exec sed -i 's|mfulearnai/chat-service:latest|your-registry/chat-service:v1.0.0|g' {} \;

# Deploy to Kubernetes
./deploy.sh --all

# Check status
kubectl get pods -n mfulearnai-services
kubectl logs -f deployment/chat-service -n mfulearnai-services
```

## 🔍 Testing

### 1. Unit Tests
```bash
cd k8s-services/chat-service
npm test
```

### 2. Integration Tests
```bash
# Test service endpoints
curl http://chat-service:3002/health
curl http://agent-service:3003/health
```

### 3. End-to-End Test
```bash
# Through API Gateway
curl -H "Authorization: Bearer $TOKEN" \
  https://mfulearnai.mfu.ac.th/api/chat/history
```

## 📊 Monitoring

### Check Metrics
```bash
# Port forward Grafana
kubectl port-forward -n mfulearnai-monitoring svc/grafana 3000:3000

# Open http://localhost:3000
# Dashboards will show:
- Service health
- Request rates
- Error rates
- Latency
```

### Check Logs
```bash
# View logs
kubectl logs -f deployment/chat-service -n mfulearnai-services

# View all service logs
kubectl logs -l app.kubernetes.io/part-of=mfulearnai -n mfulearnai-services
```

## 🐛 Troubleshooting

### Service Can't Connect to MongoDB
```bash
# Check MongoDB is running
kubectl get pods -n mfulearnai-core -l app=mongodb

# Check service DNS
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- /bin/bash
nslookup mongodb.mfulearnai-core.svc.cluster.local
```

### WebSocket Connection Issues
```bash
# Check if WebSocket is enabled in Ingress
kubectl describe ingress mfulearnai-ingress -n mfulearnai-gateway | grep websocket

# Test WebSocket connection
wscat -c wss://mfulearnai.mfu.ac.th/ws?token=YOUR_JWT_TOKEN
```

## 📝 Next Actions

1. **Choose Service to Start With**
   - Recommend: Storage Service (simplest, no dependencies)
   - Then: RAG Service
   - Then: Agent Service
   - Then: Training Service
   - Then: Chat Service
   - Finally: API Gateway

2. **For Each Service**:
   - Create directory structure
   - Copy relevant files
   - Modify service calls to HTTP
   - Add health check endpoints
   - Create Dockerfile
   - Test locally (optional)
   - Build Docker image on remote server
   - Deploy to Kubernetes
   - Test integration

3. **Complete API Gateway Last**
   - Implement all routing rules
   - Add authentication middleware
   - Setup WebSocket proxy
   - Deploy and test end-to-end

## 🎓 Learning Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Microservices Patterns](https://microservices.io/patterns/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)

## 📞 Support

- Documentation: `k8s/README.md`
- Architecture: `k8s/ARCHITECTURE.md`
- Deployment: `k8s/DEPLOYMENT.md`
- Quick Reference: `k8s/QUICKSTART.md`

---

**Note**: เอกสารนี้เป็น guide สำหรับ full implementation ไม่ใช่ simplified approach คุณจะได้ microservices ที่ทำงานได้จริงและพร้อม production
