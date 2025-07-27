# MFULearnAi LangChain Backend

ระบบ Backend ที่ใช้ LangChain สำหรับ AI Agent และ Chat System

## 🚀 Features

### LangChain Integration
- **LangChain Agent**: ใช้ LangChain Agent สำหรับ tool calling และ reasoning
- **Chain Factory**: รองรับ Simple, Conversational, และ RAG chains
- **Prompt Factory**: ระบบจัดการ prompts ที่ยืดหยุ่น
- **Advanced Tools**: tools เพิ่มเติมสำหรับ weather, translation, currency conversion, news search

### AI Agent System
- **Agent Management**: CRUD operations สำหรับ agents
- **Agent Templates**: templates สำเร็จรูปสำหรับ agents ต่างๆ
- **Tool Integration**: เชื่อมต่อ tools กับ agents
- **Memory Management**: ระบบ memory สำหรับ agents

### Chat System
- **Real-time Chat**: WebSocket สำหรับ real-time messaging
- **Streaming Responses**: รองรับ streaming responses
- **Chat History**: จัดการ chat history และ memory
- **Multi-agent Support**: รองรับการสลับ agents ใน chat

### Knowledge Base
- **Vector Database**: ใช้ ChromaDB สำหรับ vector storage
- **Document Processing**: รองรับการอัปโหลดและประมวลผลเอกสาร
- **Embedding Generation**: ใช้ AWS Bedrock สำหรับ embeddings
- **RAG (Retrieval-Augmented Generation)**: ระบบ RAG สำหรับตอบคำถาม

## 📦 Installation

### Prerequisites
- Node.js 18+
- MongoDB
- Redis
- AWS Account (สำหรับ Bedrock)

### Setup

1. **Clone และ Install Dependencies**
```bash
cd backend
npm install
```

2. **Environment Variables**
สร้างไฟล์ `.env`:
```env
# Server
PORT=3001
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/mfulearnai
REDIS_URL=redis://localhost:6379

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# JWT
JWT_SECRET=your_jwt_secret

# Frontend
FRONTEND_URL=http://localhost:5173

# Optional APIs (สำหรับ advanced tools)
OPENWEATHER_API_KEY=your_openweather_key
GOOGLE_TRANSLATE_API_KEY=your_google_translate_key
NEWS_API_KEY=your_news_api_key
```

3. **Start Development Server**
```bash
npm run dev
```

## 🏗️ Architecture

### Core Components

#### LangChain Agent (`src/agent/langchainAgent.ts`)
- สร้าง LangChain Agent ที่ใช้ tools และ memory
- รองรับ tool calling และ reasoning
- เชื่อมต่อกับ knowledge base

#### Chain Factory (`src/agent/chainFactory.ts`)
- สร้าง chains ประเภทต่างๆ:
  - **Simple Chain**: สำหรับการตอบคำถามพื้นฐาน
  - **Conversational Chain**: สำหรับการสนทนา
  - **RAG Chain**: สำหรับการตอบคำถามจาก knowledge base

#### Prompt Factory (`src/agent/promptFactory.ts`)
- จัดการ prompt templates
- รองรับ system prompts, chat history, context
- มี predefined prompts สำหรับ agents ต่างๆ

#### Advanced Tool Service (`src/services/advancedToolService.ts`)
- Weather tool
- Translation tool
- Currency converter
- News search
- Code analysis
- File operations
- Database queries

### API Endpoints

#### Agents
- `GET /api/agents` - Get all agents
- `GET /api/agents/:id` - Get agent by ID
- `POST /api/agents` - Create new agent
- `PUT /api/agents/:id` - Update agent
- `DELETE /api/agents/:id` - Delete agent
- `GET /api/agents/templates/all` - Get agent templates
- `POST /api/agents/templates/:templateId` - Create agent from template
- `GET /api/agents/tools/available` - Get available tools

#### Chat
- `GET /api/chat` - Get user chats
- `GET /api/chat/:id` - Get specific chat
- `POST /api/chat` - Create new chat
- `PUT /api/chat/:id/name` - Update chat name
- `DELETE /api/chat/:id` - Delete chat
- `POST /api/chat/:id/clear-memory` - Clear chat memory

#### Collections
- `GET /api/collections` - Get collections
- `POST /api/collections` - Create collection
- `PUT /api/collections/:id` - Update collection
- `DELETE /api/collections/:id` - Delete collection

## 🔧 Configuration

### Agent Configuration
```typescript
interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  tools: string[];
  collectionNames: string[];
  temperature: number;
  maxTokens: number;
}
```

### Chain Configuration
```typescript
interface ChainConfig {
  modelId: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  chainType: 'simple' | 'rag' | 'conversational' | 'agent';
  collectionNames: string[];
  sessionId: string;
}
```

## 🚀 Usage Examples

### Creating a LangChain Agent
```typescript
import { LangChainAgent } from './agent/langchainAgent';

const config = {
  modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
  systemPrompt: 'You are a helpful assistant.',
  temperature: 0.7,
  maxTokens: 4000,
  tools: ['calculator', 'web_search'],
  collectionNames: ['knowledge-base'],
  sessionId: 'chat-123'
};

const agent = new LangChainAgent(config);
await agent.initialize();

const response = await agent.processMessage(messages);
```

### Using Chain Factory
```typescript
import { ChainFactory } from './agent/chainFactory';

const config = {
  modelId: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
  systemPrompt: 'You are a helpful assistant.',
  temperature: 0.7,
  maxTokens: 4000,
  chainType: 'rag',
  collectionNames: ['knowledge-base'],
  sessionId: 'chat-123'
};

const chain = new ChainFactory(config);
await chain.initialize();

const response = await chain.processMessage(messages);
```

## 🔍 Monitoring

### Health Check
```bash
curl http://localhost:3001/health
```

### WebSocket Status
```bash
# ตรวจสอบ WebSocket connections
curl http://localhost:3001/api/chat/stats/overview
```

## 🛠️ Development

### Adding New Tools
1. สร้าง tool ใน `src/services/advancedToolService.ts`
2. ใช้ LangChain Tool class
3. เพิ่ม tool ใน agent configuration

### Adding New Agent Templates
1. เพิ่ม template ใน `src/services/agentService.ts`
2. กำหนด system prompt และ tools
3. ใช้ผ่าน API endpoint

### Adding New Chain Types
1. เพิ่ม chain type ใน `src/agent/chainFactory.ts`
2. สร้าง method สำหรับ chain type ใหม่
3. อัปเดต `getChain()` method

## 📚 Dependencies

### Core
- `express` - Web framework
- `mongoose` - MongoDB ODM
- `ioredis` - Redis client
- `ws` - WebSocket library

### LangChain
- `langchain` - Core LangChain library
- `@langchain/community` - Community integrations
- `@langchain/core` - Core components
- `@langchain/aws` - AWS integrations

### AWS
- `@aws-sdk/client-bedrock-runtime` - Bedrock runtime
- `@aws-sdk/client-s3` - S3 client

### Utilities
- `axios` - HTTP client
- `uuid` - UUID generation
- `jsonwebtoken` - JWT handling
- `bcryptjs` - Password hashing

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## 📄 License

MIT License 