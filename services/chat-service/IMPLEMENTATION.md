# Chat Service Implementation

## Overview

Complete implementation of a modern chat microservice using **LangChain** and **LangGraph** for the MFU Learn AI platform.

## Architecture

### Core Components

1. **LangGraph StateGraph** (`src/graph/`)
   - State management with typed channels
   - Nodes: userInput → agent → tools → response
   - Conditional routing based on agent decisions
   - Redis checkpointer for state persistence

2. **LangChain AgentExecutor** (`src/langchain/agents/`)
   - AWS Bedrock Claude 3.5 Sonnet integration
   - Dynamic tool calling
   - Configurable temperature and max tokens
   - Streaming support

3. **Tool Registry** (`src/langchain/tools/`)
   - Memory Tool: Search conversation history in MongoDB
   - RAG Tool: Retrieve from knowledge base via RAG service
   - Calculator Tool: Safe mathematical evaluation
   - Web Search Tool: Internet search (placeholder)

4. **WebSocket Streaming** (`src/controllers/websocketController.ts`)
   - JWT authentication via query parameter
   - Real-time token streaming
   - Custom LangChain callbacks
   - Graceful connection handling

5. **REST API** (`src/controllers/chatController.ts`)
   - Full CRUD operations for chats
   - Legacy endpoints for frontend compatibility
   - JWT middleware protection

## Project Structure

```
services/chat-service/
├── src/
│   ├── app.ts                      # Express app factory
│   ├── server.ts                   # Server entry point
│   ├── config/
│   │   └── config.ts               # Environment configuration
│   ├── controllers/
│   │   ├── chatController.ts       # REST API endpoints
│   │   └── websocketController.ts  # WebSocket server
│   ├── services/
│   │   └── chatService.ts          # Business logic
│   ├── graph/
│   │   ├── chatGraph.ts            # LangGraph assembly
│   │   ├── state/
│   │   │   └── chatState.ts        # State schema & channels
│   │   ├── nodes/
│   │   │   ├── userInputNode.ts    # Input validation
│   │   │   ├── agentNode.ts        # Agent execution
│   │   │   ├── toolNode.ts         # Tool execution
│   │   │   └── responseNode.ts     # Response formatting
│   │   └── edges/
│   │       └── conditionalEdges.ts # Routing logic
│   ├── checkpoints/
│   │   ├── redisCheckpointer.ts    # Redis persistence
│   │   ├── postgresCheckpointer.ts # Postgres persistence
│   │   └── checkpointerFactory.ts  # Factory pattern
│   ├── langchain/
│   │   ├── agents/
│   │   │   └── agentFactory.ts     # AgentExecutor factory
│   │   ├── llm/
│   │   │   └── llmFactory.ts       # LLM factory
│   │   └── tools/
│   │       └── toolRegistry.ts     # Tool management
│   ├── callbacks/
│   │   └── streamingCallback.ts    # WebSocket streaming
│   ├── models/
│   │   └── chat.ts                 # MongoDB schemas
│   ├── middleware/
│   │   └── auth.ts                 # JWT authentication
│   ├── clients/
│   │   ├── agentClient.ts          # Agent service client
│   │   ├── ragClient.ts            # RAG service client
│   │   └── authClient.ts           # Auth service client
│   └── utils/
│       ├── logger.ts               # Winston logger
│       └── errors.ts               # Custom errors
├── k8s/
│   ├── deployment.yaml             # K8s deployment (3 replicas)
│   ├── service.yaml                # ClusterIP service
│   ├── hpa.yaml                    # HPA (3-10 replicas)
│   ├── configmap.yaml              # Non-sensitive config
│   └── secrets.yaml.example        # Secrets template
├── Dockerfile                      # Multi-stage build
├── package.json                    # Dependencies
├── tsconfig.json                   # TypeScript config
├── .env.example                    # Environment template
├── deploy.sh                       # Deployment script
├── build.sh                        # Build script
└── README.md                       # Documentation
```

## Key Features Implemented

### ✅ LangGraph StateGraph
- Typed state channels with message merging
- Four nodes: userInput, agent, tools, response
- Conditional edges for dynamic routing
- Iteration limit protection

### ✅ State Persistence
- Redis checkpointer for production (<1ms)
- PostgreSQL checkpointer for long-term storage
- Factory pattern for easy switching
- Health checks and reconnection logic

### ✅ Real-time Streaming
- WebSocket server with JWT auth
- Custom StreamingCallbackHandler
- Events: stream_chunk, tool_start, tool_end, message_complete
- Abort controller for stop generation

### ✅ Tool Integration
- Memory tool: MongoDB conversation search
- RAG tool: HTTP client to RAG service
- Calculator: Safe eval implementation
- Extensible registry pattern

### ✅ Kubernetes Ready
- Multi-replica deployment (3 replicas)
- HPA for auto-scaling (3-10 pods)
- Resource limits and health checks
- Graceful shutdown handling

### ✅ API Compatibility
- REST endpoints match backend routes
- Legacy `/history` endpoints supported
- WebSocket protocol defined
- Error handling standardized

## Dependencies

### Core Framework
- `express` - REST API framework
- `ws` - WebSocket server
- `mongoose` - MongoDB ODM

### LangChain Stack
- `langchain` - Core framework
- `@langchain/langgraph` - State graph
- `@langchain/langgraph-checkpoint-redis` - Redis checkpointer
- `@langchain/aws` - AWS Bedrock integration
- `@langchain/core` - Core types

### Infrastructure
- `ioredis` - Redis client
- `pg` - PostgreSQL client
- `jsonwebtoken` - JWT authentication
- `axios` - HTTP client

### Utilities
- `winston` - Logging
- `helmet` - Security headers
- `cors` - CORS middleware

## Environment Variables

### Required
- `MONGODB_URI` - MongoDB connection
- `REDIS_URL` - Redis connection
- `JWT_SECRET` - JWT secret key
- `AWS_ACCESS_KEY_ID` - AWS credentials
- `AWS_SECRET_ACCESS_KEY` - AWS credentials

### Service URLs
- `AUTH_SERVICE_URL` - Auth service endpoint
- `AGENT_SERVICE_URL` - Agent service endpoint
- `RAG_SERVICE_URL` - RAG service endpoint

### Configuration
- `PORT` - Server port (default: 5002)
- `NODE_ENV` - Environment (production/development)
- `LOG_LEVEL` - Logging level (info/debug/error)
- `BEDROCK_MODEL_ID` - LLM model ID
- `MAX_ITERATIONS` - Agent iteration limit
- `CHECKPOINT_TYPE` - Checkpointer type (redis/postgres)

## API Endpoints

### REST API (`/api/chat`)
- `GET /` - List user's chats
- `GET /history` - List user's chats (legacy)
- `GET /history/:sessionId` - Get specific chat (legacy)
- `POST /` - Create new chat
- `GET /:chatId` - Get chat details
- `PUT /:chatId/name` - Update chat name
- `POST /:chatId/pin` - Pin/unpin chat
- `DELETE /:chatId` - Delete chat
- `POST /:chatId/clear-memory` - Clear chat memory
- `GET /health` - Health check

### WebSocket (`/ws/chat`)
Connect with JWT: `ws://host/ws/chat?token=<JWT>`

**Client → Server Messages:**
```json
{
  "type": "send_message",
  "data": {
    "message": "Hello",
    "chatId": "chat_id",
    "agentId": "agent_id",
    "sessionId": "session_id"
  }
}
```

```json
{
  "type": "stop_generation",
  "data": {
    "sessionId": "session_id"
  }
}
```

**Server → Client Messages:**
```json
{
  "type": "connection_established",
  "data": {
    "sessionId": "ws_session_id",
    "userId": "user_id"
  }
}
```

```json
{
  "type": "message_start",
  "data": {
    "messageId": "msg_id",
    "chatId": "chat_id"
  }
}
```

```json
{
  "type": "stream_chunk",
  "data": {
    "messageId": "msg_id",
    "chunk": "text"
  }
}
```

```json
{
  "type": "tool_start",
  "data": {
    "messageId": "msg_id",
    "toolName": "rag_retrieval",
    "input": "query"
  }
}
```

```json
{
  "type": "tool_end",
  "data": {
    "messageId": "msg_id",
    "toolName": "rag_retrieval",
    "output": "result"
  }
}
```

```json
{
  "type": "message_complete",
  "data": {
    "messageId": "msg_id",
    "chatId": "chat_id"
  }
}
```

```json
{
  "type": "message_error",
  "data": {
    "messageId": "msg_id",
    "chatId": "chat_id",
    "error": "error message"
  }
}
```

## Deployment

### Local Development
```bash
npm install
cp .env.example .env
npm run dev
```

### Docker Build
```bash
./build.sh latest
```

### Kubernetes Deployment
```bash
# Create secrets first
kubectl create secret generic chat-service-secrets \
  --from-literal=mongodb-uri="..." \
  --from-literal=redis-url="..." \
  --from-literal=jwt-secret="..." \
  --from-literal=aws-access-key-id="..." \
  --from-literal=aws-secret-access-key="..." \
  -n mfulearnai

# Deploy
./deploy.sh production
```

### Ingress Configuration
Routes already configured in `k8s/ingress.yaml`:
- `/api/chat` → chat-service:5002
- `/ws/chat` → chat-service:5002

## Testing

### Health Check
```bash
curl http://localhost:5002/health
```

### WebSocket Test
```javascript
const ws = new WebSocket('ws://localhost:5002/ws/chat?token=<JWT>');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'send_message',
    data: {
      message: 'Hello!',
      chatId: 'chat_id',
      sessionId: 'chat_id'
    }
  }));
};

ws.onmessage = (event) => {
  console.log('Received:', JSON.parse(event.data));
};
```

## Integration Points

### With Auth Service
- JWT validation for all requests
- User ID extraction from token
- Token refresh support

### With Agent Service
- Fetch agent configuration
- Get agent tools and prompts
- Dynamic agent selection

### With RAG Service
- Document retrieval via RAG tool
- Collection management
- Similarity search

### With Frontend
- WebSocket for chat interface
- REST API for chat management
- Legacy endpoints for compatibility

## Monitoring

### Health Check
- MongoDB connection status
- Redis checkpointer status
- Service readiness

### Logs
- Structured JSON logging with Winston
- Request/response logging
- Error tracking with context

### Metrics (Future)
- Prometheus metrics endpoint
- Request duration histogram
- Active connections gauge
- Tool usage counter

## Future Enhancements

1. **Memory Service Integration**
   - Implement ChromaDB for semantic memory search
   - Replace simple keyword search

2. **Web Search Tool**
   - Integrate external search API
   - Implement search result parsing

3. **Metrics & Observability**
   - Prometheus metrics
   - OpenTelemetry tracing
   - Grafana dashboards

4. **Advanced Features**
   - Multi-agent collaboration
   - Conversation summarization
   - Sentiment analysis
   - Language detection

5. **Performance Optimization**
   - Response caching
   - Tool result caching
   - Connection pooling tuning

## Security Considerations

- JWT authentication on all endpoints
- Input validation and sanitization
- Rate limiting (TODO)
- CORS configuration
- Helmet security headers
- Non-root Docker user
- Secret management via Kubernetes secrets

## License

MIT
