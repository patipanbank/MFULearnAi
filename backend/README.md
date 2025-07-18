# MFULearnAi Backend - แผนการ Refactor ระบบแชทและ Agent

## 1. ภาพรวมระบบใหม่

ระบบ backend จะถูกออกแบบใหม่ให้รองรับการแชทแบบ real-time, multi-agent, memory, RAG, tool calling, และการเชื่อมต่อกับ AWS Bedrock/LangChain ตาม best practice ล่าสุด โดยมีโครงสร้างดังนี้

- **WebSocket Gateway**: รับ/ส่งข้อความแบบ real-time
- **Session & Chat Management**: จัดการห้องแชท, ประวัติ, memory
- **Agent Orchestration**: เลือก agent, เรียก LLM, tool, RAG
- **LLM/Bedrock Integration**: เชื่อมต่อ LLM ผ่าน LangChain/Bedrock
- **Knowledge Base**: รองรับ vector store, RAG
- **Tool/Function Calling**: เรียก external tools
- **Security & Monitoring**: ครอบคลุม auth, logging, audit

---

## 2. โครงสร้างโฟลเดอร์หลัก

```
src/
  agents/         // Factory, registry, prompt, tool สำหรับ agent/LLM
  config/         // การตั้งค่าระบบ
  lib/            // MongoDB, queue, redis
  middleware/     // Auth, security
  models/         // Schema: chat, agent, user
  queueHandlers/  // Handler งาน background
  routes/         // REST API, WebSocket endpoint
  services/       // Chat, agent, websocket, bedrock, langchain, memory ฯลฯ
  utils/          // redis, websocket, security
  workers/        // worker สำหรับ background job
```

---

## 3. Flow หลักของระบบแชท

### 3.1 WebSocket Flow

- Client เชื่อมต่อ `/ws` พร้อม JWT token
- Authen token → สร้าง session
- รองรับ event: `create_room`, `join_room`, `send_message`, `typing`, `disconnect`
- ส่ง/รับข้อความแบบ real-time, รองรับ reconnect, stream ข้อความจาก LLM

### 3.2 Chat & Session Management

- สร้าง/ดึง/ลบห้องแชท (`chatService`)
- เก็บประวัติแชท (MongoDB)
- รองรับ memory หลายแบบ (buffer, summary, vector, redis)
- Trim/summarize history อัตโนมัติเมื่อเกิน context window

### 3.3 Agent Orchestration

- เลือก agent ตาม user/room/intent
- รองรับ agent หลายแบบ (single, multi, sequential, parallel)
- เรียก LLM ผ่าน LangChain/Bedrock
- รองรับ tool calling, RAG, function calling

### 3.4 LLM/Bedrock Integration

- เชื่อมต่อ Bedrock ผ่าน SDK/LangChain
- รองรับ model หลายตัว (Claude, Titan, OpenAI ฯลฯ)
- สร้าง embedding, generate, stream response

### 3.5 Knowledge Base & RAG

- รองรับ vector store (Aurora pgvector, OpenSearch, Bedrock Knowledge Base)
- ดึง context ก่อนส่ง prompt เข้า LLM
- ออกแบบให้ขยายได้ (plug-in vector store)

### 3.6 Tool/Function Calling

- Agent สามารถเรียก external tool (API, function) ผ่าน tool registry
- รองรับ tool หลายประเภท (retriever, web search, calculator ฯลฯ)
- เก็บผลการใช้ tool ใน message (toolUsage)

---

## 4. Data Structure หลัก

### 4.1 Chat

- `userId`, `name`, `messages[]`, `agentId`, `modelId`, `collectionNames[]`, `isPinned`, `createdAt`, `updatedAt`
- `messages[]`: `id`, `role`, `content`, `timestamp`, `images[]`, `isStreaming`, `isComplete`, `toolUsage[]`

### 4.2 Agent

- `name`, `description`, `systemPrompt`, `modelId`, `collectionNames[]`, `tools[]`, `temperature`, `maxTokens`, `isPublic`, `tags[]`, `createdBy`, `createdAt`, `updatedAt`, `usageCount`, `rating`

### 4.3 User

- `nameID`, `username`, `email`, `firstName`, `lastName`, `department`, `role`, `groups[]`, `created`, `updated`

---

## 5. REST API & WebSocket Endpoint

### 5.1 REST API (ตัวอย่าง)

- `GET /chat` - ดึงห้องแชททั้งหมดของ user
- `GET /chat/history/:sessionId` - ดึงประวัติแชท
- `POST /chat` - สร้างห้องแชทใหม่
- `POST /chat/:chatId/message` - ส่งข้อความ (กรณี fallback จาก websocket)
- `DELETE /chat/:chatId` - ลบห้องแชท

### 5.2 WebSocket Event

- `create_room` - สร้างห้องใหม่
- `join_room` - เข้าห้อง
- `send_message` - ส่งข้อความ
- `typing` - แจ้งสถานะ typing
- `disconnect` - ออกจากระบบ

---

## 6. Agent, LLM, Tool, Memory

- Agent config ผ่าน MongoDB (`models/agent.ts`)
- LLM เลือก model ได้ (Claude, Titan, OpenAI)
- Tool registry รองรับ dynamic tool (retriever, web search, function)
- Memory รองรับ buffer, summary, vector, redis

---

## 7. Security & Monitoring

- Authen ทุก request ด้วย JWT/OAuth2
- Input validation ทุก endpoint
- Logging, audit, monitoring (CloudWatch, SIEM)
- Encryption at rest & in transit (TLS, KMS, S3, MongoDB)
- Rate limit, DDoS protection (รองรับ WAF/Shield ถ้า deploy บน AWS)

---

## 8. Deployment & Environment

- ใช้ Docker (ดู `Dockerfile`)
- Build ด้วย `npm run build`
- Start server: `npm start`
- Start worker: `npm run worker` หรือ `npm run start-workers`
- ตั้งค่า env: MongoDB, Redis, AWS credentials, Bedrock model id ฯลฯ

---

## 9. แผนการ Refactor (Step-by-step)

# สถานะการดำเนินงาน (Implementation Progress)

## 1. Refactor WebSocket Gateway: ให้รองรับ event และ reconnect ตาม frontend
- [x] 1.1 ศึกษาและ mapping event ที่ frontend ใช้งานจริง (create_room, join_room, send_message, typing, disconnect, reconnect) — เสร็จสิ้น
- [x] 1.2 ปรับปรุง WebSocket server ให้รองรับ JWT authentication ที่ handshake — implement แล้ว: ตรวจสอบ token ที่ query string และ verify JWT ทุกครั้งที่เชื่อมต่อ, ปิด connection ทันทีหาก token ไม่ถูกต้อง
- [x] 1.3 ออกแบบและ implement session management สำหรับแต่ละ connection — implement แล้ว: userSessions map, join/leave session, cleanup เมื่อปิด connection
- [x] 1.4 รองรับ reconnect และ session recovery (token expiry, auto reconnect) — implement แล้ว: ปิด connection ด้วยรหัสมาตรฐาน, client สามารถ reconnect ได้ทันที, รองรับ session recovery
- [x] 1.5 รองรับการ broadcast message ไปยัง client ที่อยู่ในห้องเดียวกัน — implement แล้ว: ใช้ wsManager.broadcastToSession ในทุก event ที่เกี่ยวข้อง
- [x] 1.6 รองรับการ stream ข้อความจาก LLM แบบ chunked/partial response — implement แล้ว: ส่ง chunk ผ่าน broadcastToSession ด้วย type: 'chunk'
- [x] 1.7 จัดการ error handling และปิด connection อย่างปลอดภัย — implement แล้ว: try/catch รอบ critical section, ส่ง error event, ปิด connection ด้วยรหัสที่เหมาะสม
- [ ] 1.8 ทดสอบการเชื่อมต่อและ event flow กับ frontend จริง

## 2. Refactor Chat/Session Service: รองรับ memory หลายแบบ, trim/summarize history
- [x] 2.1 ออกแบบ interface สำหรับ memory หลายแบบ (buffer, summary, vector, redis) — implement แล้ว: memoryService รองรับ buffer, summary, vector (mock redis)
- [x] 2.2 ปรับ schema chat/message ให้รองรับ metadata เพิ่มเติม (summary, vector ref) — implement แล้ว: ขยาย ChatMessage รองรับ summary, vectorRef, role: 'system'
- [x] 2.3 Implement memory buffer (เก็บข้อความล่าสุดใน context window) — implement แล้ว: logic buffer/trim ใน addMessage/processMessage
- [x] 2.4 Implement memory summary (สรุปบทสนทนาเมื่อยาวเกิน context) — implement แล้ว: สร้าง summary message อัตโนมัติเมื่อเกิน threshold
- [x] 2.5 Integrate redis เป็น short-term memory (ถ้ามี) — implement แล้ว: ใช้ in-memory map/mock redis
- [x] 2.6 สร้าง logic สำหรับ trim/summarize history อัตโนมัติ — implement แล้ว: trim/summarize ใน addMessage/processMessage

## 3. สร้าง Agent Orchestrator ด้วย LangChain: รองรับ agent หลายแบบ, tool calling, RAG
- [x] 3.1 ออกแบบ agent config (single, multi, sequential, parallel, hierarchical) — implement แล้ว: mock logic เลือก agentExecutor ตาม agentType
- [x] 3.2 ปรับ agentFactory/toolRegistry ให้รองรับ dynamic agent/tool — implement แล้ว: getToolsForSession, dynamic retriever tool
- [x] 3.3 Integrate LangChain agent executor (เลือก agent ตาม config) — implement แล้ว: เลือก agentExecutor ตาม agent config (mock)
- [x] 3.4 รองรับ tool calling (function calling, external API) — implement แล้ว: tools รองรับ function calling, external API
- [x] 3.5 รองรับ RAG (retrieval augmented generation) ผ่าน LangChain — implement แล้ว: retriever tool (mock logic)

## 4. เชื่อมต่อ Bedrock ผ่าน LangChain/SDK: รองรับ model หลายตัว, knowledge base
- [x] 4.1 ศึกษาและ mapping model ที่ต้องรองรับ (Claude, Titan, OpenAI ฯลฯ) — implement แล้ว: listSupportedModels() คืนค่ารายชื่อ model ที่รองรับ
- [x] 4.2 ปรับ bedrockService ให้เลือก model ได้ตาม agent config — implement แล้ว: ทุกฟังก์ชันรับ modelId เป็น argument, default เป็น defaultModelId
- [x] 4.3 Integrate LangChain LLM interface กับ Bedrock SDK — implement แล้ว: getLangChainLLM(modelId) คืน object ที่ใช้ Bedrock SDK
- [x] 4.4 รองรับการสร้าง embedding, generate, stream response — implement แล้ว: createTextEmbedding, converseStream, generateImage, createImageEmbedding

## 5. ปรับ API/Message Format ให้ตรงกับ frontend: message, toolUsage, images, isStreaming
- [x] 5.1 ศึกษา message format ที่ frontend ใช้งานจริง — implement แล้ว: ปรับ message ที่ส่งผ่าน WebSocket ให้ตรงกับ spec frontend (id, role, content, timestamp, ...)
- [x] 5.2 ปรับ chatService/websocketService ให้ส่ง/รับข้อมูลตรง format — implement แล้ว: รองรับ images, toolUsage, isStreaming ใน message object
- [x] 5.3 รองรับ images, toolUsage, isStreaming ใน message object — implement แล้ว: message ที่ stream ไป frontend มี isStreaming, toolUsage, images (mock)
- [ ] 5.4 ทดสอบการแสดงผลและการรับส่งข้อมูลกับ frontend

## 6. เพิ่ม Security Layer: input validation, auth, logging, monitoring
- [ ] 6.1 ตรวจสอบและเพิ่ม input validation ทุก endpoint (REST, WS)
- [ ] 6.2 ตรวจสอบ JWT/OAuth2 auth ทุกจุด (REST, WS handshake)
- [ ] 6.3 เพิ่ม logging ที่สำคัญ (event, error, audit)
- [ ] 6.4 Integrate monitoring (CloudWatch, SIEM, alert)
- [ ] 6.5 ทดสอบ security flow และ logging จริง

## 7. เพิ่ม Test Coverage และ Monitoring: unit test, integration test, logging, alert
- [ ] 7.1 เขียน unit test สำหรับ service/utility หลัก
- [ ] 7.2 เขียน integration test สำหรับ flow สำคัญ (chat, agent, websocket)
- [ ] 7.3 ทดสอบ error case และ edge case
- [ ] 7.4 ตรวจสอบ log/alert ว่าทำงานจริง

## 8. Document Flow และ API Contract: OpenAPI/Swagger, README, Sequence Diagram
- [ ] 8.1 สร้าง OpenAPI/Swagger spec สำหรับ REST API
- [ ] 8.2 วาด sequence diagram สำหรับ flow หลัก (chat, agent, websocket)
- [ ] 8.3 อัปเดต README.md ให้ตรงกับ implementation จริง
- [ ] 8.4 จัดทำเอกสารการ deploy, config, environment

---

## 10. อ้างอิง Best Practice

- [LangChain Chatbot Architecture Guide](https://medium.com/towards-agi/how-to-design-chatbot-architecture-with-langchain-guide-08b4f8f9f688)
- [AWS Bedrock RAG Chatbot Security Blueprint](https://aws.amazon.com/blogs/security/hardening-the-rag-chatbot-architecture-powered-by-amazon-bedrock-blueprint-for-secure-design-and-anti-pattern-migration/)
- [High-Speed RAG Chatbots on AWS](https://aws.amazon.com/solutions/guidance/high-speed-rag-chatbots-on-aws/)
- [Build a contextual chatbot application using Knowledge Bases for Amazon Bedrock](https://aws.amazon.com/blogs/machine-learning/build-a-contextual-chatbot-application-using-knowledge-bases-for-amazon-bedrock/)

---

**หมายเหตุ:**  
- สามารถขอรายละเอียดเชิงเทคนิคแต่ละจุด หรือขอแผนย่อยสำหรับแต่ละขั้นตอนเพิ่มเติมได้  
- หากต้องการตัวอย่าง code snippet, sequence diagram, หรือ API contract สามารถแจ้งได้ 