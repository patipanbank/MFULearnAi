# ระบบ WebSocket ที่สมบูรณ์สำหรับ MFULearnAi

## ภาพรวม

ระบบ WebSocket นี้ถูกออกแบบมาเพื่อรองรับการสนทนากับ AI agents แบบ real-time โดยมีคุณสมบัติดังนี้:

- **Real-time Chat**: การสนทนากับ AI แบบ streaming
- **Agent Management**: จัดการ AI agents และ templates
- **Session Management**: จัดการการสนทนาหลาย session
- **Tool Integration**: AI ใช้ tools ต่างๆ
- **Redis Integration**: สำหรับ message queue และ caching
- **MongoDB Storage**: เก็บข้อมูลการสนทนาและ agents

## โครงสร้างไฟล์

```
backend/src/
├── models/
│   ├── chat.ts          # Chat และ ChatMessage models
│   └── agent.ts         # Agent และ AgentTemplate models
├── services/
│   ├── websocketService.ts    # WebSocket server management
│   ├── chatService.ts         # Chat logic และ AI processing
│   └── agentService.ts        # Agent management
├── routes/
│   ├── chat.ts          # Chat REST API endpoints
│   └── agent.ts         # Agent REST API endpoints
├── utils/
│   └── websocketManager.ts    # WebSocket connection management
└── app.ts               # Main application setup
```

## การติดตั้ง

### 1. ติดตั้ง Dependencies

```bash
npm install ws @types/ws socket.io @types/socket.io redis @types/redis uuid @types/uuid
```

### 2. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` ในโฟลเดอร์ `backend`:

```env
# Server Configuration
PORT=3001
APP_ENV=development
LOG_LEVEL=info

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/mfulearnai

# Redis Configuration (for WebSocket)
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Session Configuration
SESSION_SECRET=your-session-secret-here

# Frontend URLs
DEV_FRONTEND_URL=http://localhost:3000
PROD_FRONTEND_URL=https://mfulearnai.mfu.ac.th

# CORS Configuration
DEV_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
PROD_ALLOWED_ORIGINS=https://mfulearnai.mfu.ac.th
```

### 3. รัน Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## การใช้งาน

### WebSocket Connection

Frontend สามารถเชื่อมต่อ WebSocket ได้ที่:

```
ws://localhost:3001/ws?token=YOUR_JWT_TOKEN
```

### WebSocket Message Types

#### 1. Client to Server

**Join Room**
```json
{
  "type": "join_room",
  "chatId": "chat_id_here"
}
```

**Create Room**
```json
{
  "type": "create_room",
  "name": "New Chat",
  "agent_id": "agent_id_here"
}
```

**Send Message**
```json
{
  "type": "message",
  "chatId": "chat_id_here",
  "text": "Hello, how are you?",
  "images": [
    {
      "url": "https://example.com/image.jpg",
      "mediaType": "image/jpeg"
    }
  ],
  "agent_id": "agent_id_here"
}
```

**Leave Room**
```json
{
  "type": "leave_room"
}
```

**Ping**
```json
{
  "type": "ping"
}
```

#### 2. Server to Client

**Room Joined**
```json
{
  "type": "room_joined",
  "data": {
    "chatId": "chat_id_here"
  }
}
```

**Room Created**
```json
{
  "type": "room_created",
  "data": {
    "chatId": "chat_id_here"
  }
}
```

**Message Accepted**
```json
{
  "type": "accepted",
  "data": {
    "chatId": "chat_id_here"
  }
}
```

**Streaming Response**
```json
{
  "type": "chunk",
  "data": "Hello"
}
```

**Tool Usage**
```json
{
  "type": "tool_start",
  "data": {
    "messageId": "msg_id",
    "tool_name": "web_search",
    "tool_input": "Searching for information...",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

**End of Response**
```json
{
  "type": "end",
  "data": {
    "messageId": "msg_id",
    "sessionId": "chat_id_here"
  }
}
```

**Error**
```json
{
  "type": "error",
  "data": "Error message here"
}
```

**Pong**
```json
{
  "type": "pong"
}
```

## REST API Endpoints

### Chat Endpoints

- `GET /api/chat` - Get user's chat history
- `GET /api/chat/:chatId` - Get specific chat
- `POST /api/chat` - Create new chat
- `PUT /api/chat/:chatId/name` - Update chat name
- `DELETE /api/chat/:chatId` - Delete chat
- `GET /api/chat/stats/overview` - Get chat statistics (admin only)

### Agent Endpoints

- `GET /api/agent` - Get all agents
- `GET /api/agent/:agentId` - Get specific agent
- `POST /api/agent` - Create new agent
- `PUT /api/agent/:agentId` - Update agent
- `DELETE /api/agent/:agentId` - Delete agent
- `GET /api/agent/templates/all` - Get agent templates
- `POST /api/agent/templates/:templateId` - Create agent from template
- `GET /api/agent/search/:query` - Search agents
- `GET /api/agent/popular/:limit?` - Get popular agents
- `POST /api/agent/:agentId/rate` - Rate an agent

## คุณสมบัติหลัก

### 1. Real-time Chat
- การสนทนากับ AI แบบ streaming
- รองรับการแนบรูปภาพ
- Tool usage tracking
- Message history

### 2. Agent Management
- สร้างและจัดการ AI agents
- Agent templates
- Public/private agents
- Rating system
- Usage tracking

### 3. Session Management
- Multiple chat sessions
- Session persistence
- User access control
- Chat pinning

### 4. Tool Integration
- Web search
- Calculator
- Custom tools
- Tool usage tracking

### 5. Security
- JWT authentication
- User authorization
- Rate limiting (TODO)
- Input validation

## การพัฒนาต่อ

### ระบบที่ต้องทำเพิ่มเติม:

1. **AI/LLM Integration**
   - Bedrock Service สำหรับ AWS Bedrock
   - LLM Factory สำหรับสร้าง LLM instances
   - Tool Registry สำหรับจัดการ tools

2. **Knowledge Base System**
   - Chroma Service สำหรับ vector database
   - Collection Service สำหรับจัดการ knowledge
   - Embedding Service สำหรับสร้าง embeddings

3. **Background Processing**
   - Celery Tasks สำหรับประมวลผล AI
   - Redis Integration สำหรับ message queue

4. **Advanced Features**
   - Memory Management
   - Usage Tracking
   - Rate Limiting
   - Analytics

### ตัวอย่างการใช้งานใน Frontend:

```typescript
// เชื่อมต่อ WebSocket
const ws = new WebSocket(`ws://localhost:3001/ws?token=${jwtToken}`);

// ส่งข้อความ
ws.send(JSON.stringify({
  type: 'message',
  chatId: 'chat_id',
  text: 'Hello, how are you?',
  agent_id: 'agent_id'
}));

// รับข้อความ
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch (data.type) {
    case 'chunk':
      // แสดง streaming response
      break;
    case 'tool_start':
      // แสดง tool usage
      break;
    case 'end':
      // จบการตอบสนอง
      break;
  }
};
```

## การแก้ไขปัญหา

### ปัญหาที่พบบ่อย:

1. **WebSocket ไม่เชื่อมต่อ**
   - ตรวจสอบ JWT token
   - ตรวจสอบ Redis connection
   - ตรวจสอบ CORS settings

2. **ข้อความไม่ส่ง**
   - ตรวจสอบ WebSocket connection state
   - ตรวจสอบ message format
   - ตรวจสอบ server logs

3. **AI ไม่ตอบสนอง**
   - ตรวจสอบ agent configuration
   - ตรวจสอบ model ID
   - ตรวจสอบ system prompt

## การทดสอบ

```bash
# ทดสอบ WebSocket connection
wscat -c "ws://localhost:3001/ws?token=YOUR_TOKEN"

# ทดสอบ REST API
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:3001/api/chat
```

## การ Deploy

1. ตั้งค่า environment variables สำหรับ production
2. รัน `npm run build`
3. ใช้ PM2 หรือ Docker สำหรับ deployment
4. ตั้งค่า nginx สำหรับ WebSocket proxy
5. ตั้งค่า SSL certificate

## สรุป

ระบบ WebSocket นี้ให้พื้นฐานที่แข็งแกร่งสำหรับการสร้างแอปพลิเคชันแชท AI แบบ real-time โดยรองรับการขยายตัวและเพิ่มฟีเจอร์ใหม่ๆ ได้ในอนาคต 