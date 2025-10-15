# Chat Service

Modern chat microservice built with **LangChain** and **LangGraph** for MFU Learn AI platform.

## Features

- ✅ **LangGraph StateGraph** - Stateful conversation management
- ✅ **LangChain AgentExecutor** - AI agent with tool calling
- ✅ **Redis Checkpointer** - Fast state persistence (<1ms)
- ✅ **WebSocket Streaming** - Real-time token streaming
- ✅ **Tool Registry** - Dynamic tool management
- ✅ **Horizontal Scaling** - Kubernetes-ready with HPA

## Architecture

```
Chat Service (Express + WebSocket)
    ↓
LangGraph StateGraph
    ├── User Input Node
    ├── Agent Node (AgentExecutor + Tools)
    ├── Tool Node
    └── Response Node
    ↓
Redis Checkpointer (State) + MongoDB (History)
```

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Run in development mode
npm run dev
```

### Production

```bash
# Build
npm run build

# Start
npm start
```

## Environment Variables

See `.env.example` for all configuration options.

Key variables:
- `REDIS_URL` - Redis connection for checkpointer
- `MONGODB_URI` - MongoDB for chat storage
- `JWT_SECRET` - JWT authentication secret
- `AWS_REGION` - AWS Bedrock configuration
- `BEDROCK_MODEL_ID` - Default LLM model

## API Endpoints

### REST API

- `GET /api/chat` - List user's chats
- `POST /api/chat` - Create new chat
- `GET /api/chat/:chatId` - Get chat details
- `PUT /api/chat/:chatId/name` - Update chat name
- `DELETE /api/chat/:chatId` - Delete chat
- `GET /health` - Health check

### WebSocket

Connect to `ws://localhost:5002/ws?token=<JWT>`

**Client → Server:**
```json
{
  "type": "send_message",
  "data": {
    "sessionId": "chat_id",
    "content": "Hello"
  }
}
```

**Server → Client:**
```json
{
  "type": "stream_chunk",
  "data": {
    "messageId": "msg_123",
    "chunk": "Hello",
    "timestamp": "2025-01-15T..."
  }
}
```

## Deployment

### Docker

```bash
# Build image
docker build -t mfulearnai/chat-service:latest .

# Run container
docker run -p 5002:5002 --env-file .env mfulearnai/chat-service:latest
```

### Kubernetes

```bash
# Create namespace (if not exists)
kubectl create namespace mfulearnai

# Create secrets (required)
kubectl create secret generic chat-service-secrets \
  --from-literal=mongodb-uri="mongodb://..." \
  --from-literal=redis-url="redis://..." \
  --from-literal=jwt-secret="..." \
  --from-literal=aws-access-key-id="..." \
  --from-literal=aws-secret-access-key="..." \
  -n mfulearnai

# Deploy service
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/hpa.yaml

# Verify deployment
kubectl get pods -n mfulearnai -l app=chat-service
kubectl logs -n mfulearnai -l app=chat-service --tail=100
```

### Update Ingress

The chat service routes are already configured in the main ingress:
- `/api/chat` - REST API
- `/ws/chat` - WebSocket

Apply the updated ingress:
```bash
kubectl apply -f ../../k8s/ingress.yaml
```

## Monitoring

Health check endpoint: `GET /health`

Returns:
```json
{
  "status": "ok",
  "checks": {
    "mongodb": true,
    "checkpointer": true
  }
}
```

## License

MIT
