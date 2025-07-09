# MFULearnAI Backend Architecture

## ภาพรวม

MFULearnAI Backend เป็นระบบที่ซับซ้อนที่สร้างด้วย **Python/FastAPI** เพื่อรองรับ AI Learning Platform ที่มีความสามารถในการ:
- AI Agent System ที่ซับซ้อน
- Real-time Chat ผ่าน WebSocket
- Vector Database สำหรับ RAG (Retrieval-Augmented Generation)
- Multi-user Authentication
- Background Task Processing
- File Upload & Storage
- Monitoring & Statistics

## สถาปัตยกรรมระบบ

### Tech Stack
- **Framework**: FastAPI
- **Language**: Python 3.11+
- **Database**: MongoDB (หลัก)
- **Cache/Queue**: Redis (Chat History + PubSub + Task Queue)
- **Vector DB**: ChromaDB (Embeddings)
- **Task Queue**: Celery
- **File Storage**: MinIO (S3-compatible)
- **LLM Provider**: AWS Bedrock (Claude, GPT, etc.)
- **Web Server**: Nginx (Reverse Proxy)
- **Container**: Docker + Docker Compose

### Core Components

#### 1. Models (`/models/`)
- **User Model**: Authentication, roles, departments
- **Agent Model**: LLM agents, tools, templates
- **Chat Model**: Messages, sessions, history
- **Collection Model**: Knowledge base collections
- **Department Model**: Organization structure

#### 2. Services (`/services/`)
- **ChatService**: Core chat functionality
- **AgentService**: Agent management and templates
- **ChromaService**: Vector database operations
- **BedrockService**: LLM integrations
- **UserService**: User management
- **CollectionService**: Knowledge base management
- **DocumentService**: File processing
- **TrainingService**: AI training workflows

#### 3. Routes (`/routes/`)
- **`/api/chat`**: Chat endpoints + WebSocket
- **`/api/agents`**: Agent management
- **`/api/auth`**: Authentication
- **`/api/admin`**: Admin operations
- **`/api/collections`**: Knowledge base
- **`/api/departments`**: Organization management
- **`/api/stats`**: Analytics and monitoring
- **`/api/bedrock`**: Direct LLM API access

#### 4. Agents System (`/agents/`)
- **AgentFactory**: สร้าง LangChain agents
- **LLMFactory**: จัดการ LLM connections
- **PromptFactory**: Template management
- **ToolRegistry**: Tool system สำหรับ agents

#### 5. Tasks (`/tasks/`)
- **ChatTasks**: Background chat processing
- **TrainingTasks**: AI training workflows

#### 6. Middleware
- **ProxyHeaders**: Handle reverse proxy headers
- **RoleGuard**: Role-based access control

#### 7. Utils
- **WebSocketManager**: Real-time communication
- **TextSplitter**: Document processing
- **Security**: JWT, password hashing
- **RedisListener**: PubSub message handling

## Memory Management System

### Hybrid Memory Architecture
1. **Redis Memory**: Recent conversations (last 10 messages)
2. **Memory Tool**: Long-term storage with periodic embedding
3. **Periodic Embedding**: ทุก 10 messages
4. **Semantic Search**: Search through chat history

### Memory Flow
```
User Message → Redis (Recent) → Agent Processing → Response
     ↓
Every 10 messages → ChromaDB Embedding → Long-term Storage
```

## Real-time Chat Architecture

### WebSocket Flow
```
Frontend → WebSocket → FastAPI → Celery Task → Redis PubSub → WebSocket → Frontend
```

### Chat Processing
1. **Message Received**: WebSocket receives user message
2. **Background Task**: Celery task processes with LLM
3. **Streaming**: Real-time response streaming via Redis
4. **Tool Events**: Agent tool usage events
5. **Memory Update**: Update both Redis and ChromaDB

## Authentication System

### Supported Methods
- **JWT**: Standard token-based auth
- **Google OAuth**: Single sign-on
- **SAML**: Enterprise authentication
- **Role-based**: Admin, Staff, Students, SuperAdmin

### Authorization Flow
```
Request → JWT Validation → Role Check → Permission Grant → Resource Access
```

## Agent System Architecture

### Agent Components
- **LLM Factory**: จัดการ model connections
- **Tool Registry**: Static และ dynamic tools
- **Memory Tools**: Chat history search
- **Retrieval Tools**: Vector search สำหรับ collections
- **Web Search**: Google Search API integration

### Agent Execution Flow
```
User Query → Agent Selection → Tool Analysis → LLM Processing → Tool Execution → Response
```

## Database Schema

### MongoDB Collections
- **users**: User accounts และ profiles
- **chats**: Chat sessions และ messages
- **agents**: AI agent definitions
- **collections**: Knowledge base collections
- **departments**: Organization structure
- **chat_stats**: Usage statistics
- **training_history**: AI training logs

### Redis Keys
- **chat:{session_id}**: Chat history
- **pubsub:chat:{session_id}**: Real-time messages
- **celery:tasks**: Background tasks

## API Endpoints

### Authentication
- `POST /api/auth/login`: User login
- `POST /api/auth/google`: Google OAuth
- `POST /api/auth/saml`: SAML authentication
- `POST /api/auth/refresh`: Token refresh

### Chat
- `GET /api/chat/sessions`: Chat sessions
- `POST /api/chat/sessions`: Create chat
- `DELETE /api/chat/{chat_id}`: Delete chat
- `WebSocket /ws`: Real-time chat

### Agents
- `GET /api/agents`: List agents
- `POST /api/agents`: Create agent
- `GET /api/agents/templates`: Agent templates
- `PUT /api/agents/{agent_id}`: Update agent

### Collections
- `GET /api/collections`: List collections
- `POST /api/collections`: Create collection
- `POST /api/collections/{id}/documents`: Upload documents
- `DELETE /api/collections/{id}`: Delete collection

### Admin
- `GET /api/admin/users`: User management
- `POST /api/admin/users`: Create user
- `GET /api/admin/stats`: System statistics
- `GET /api/admin/logs`: System logs

## Environment Configuration

### Required Variables
```env
# Database
MONGODB_URI=mongodb://...
REDIS_URL=redis://...
CHROMA_URL=http://chroma:8000

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_BEDROCK_MODEL_ID=...

# Authentication
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Services
FRONTEND_URL=...
ALLOWED_ORIGINS=...
```

## Deployment

### Docker Compose Services
- **backend**: FastAPI application
- **frontend**: React application
- **nginx**: Reverse proxy
- **db**: MongoDB database
- **redis**: Cache and queue
- **chroma**: Vector database
- **worker**: Celery worker
- **minio**: File storage

### Production Considerations
- **SSL**: Certificate management
- **Scaling**: Multiple workers
- **Monitoring**: Prometheus metrics
- **Logging**: Structured logging
- **Health Checks**: Service monitoring

## Development Setup

### Prerequisites
- Python 3.11+
- Docker & Docker Compose
- Redis
- MongoDB

### Installation
```bash
# Install dependencies
pip install -r requirements.txt

# Start services
docker-compose up -d

# Run backend
uvicorn main:app --reload --port 5000
```

### Testing
```bash
# Run tests
pytest

# Load testing
python test_google_search.py
```

## Performance Characteristics

### Strengths
- **Scalable**: Microservices architecture
- **Real-time**: WebSocket + Redis PubSub
- **Flexible**: Plugin-based agent system
- **Efficient**: Memory management optimization
- **Reliable**: Background task processing

### Potential Bottlenecks
- **Python GIL**: Limited CPU parallelism
- **Memory Usage**: Large model loading
- **Database Queries**: Complex aggregations
- **Vector Search**: ChromaDB performance

## Migration Considerations

### Why Node.js?
- **Performance**: Better concurrency
- **TypeScript**: Type safety
- **Ecosystem**: Rich npm packages
- **Scalability**: Event-driven architecture
- **Development**: Faster iteration

### Migration Strategy
1. **Framework Selection**: NestJS vs Express
2. **Database Layer**: MongoDB driver migration
3. **Real-time**: Socket.io implementation
4. **Background Tasks**: Bull/BullMQ
5. **Agent System**: LangChain.js integration
6. **Testing**: Parallel deployment strategy

## Next Steps

ในการ migrate ไป Node.js 20 เราจะต้อง:
1. เลือก Framework (แนะนำ NestJS)
2. Migrate models และ database layer
3. Implement WebSocket และ real-time features
4. Port agent system
5. Setup background job processing
6. Testing และ validation

---

**Last Updated**: 2024-01-XX
**Version**: 1.0.0
**Author**: MFULearnAI Team 