# MFU Learn AI

A comprehensive AI learning platform for Mae Fah Luang University.

## Recent Updates

### Periodic Memory Embedding System (Latest)

**Problem**: Agent was responding to old questions from Redis memory instead of current user questions, and needed efficient memory management for long conversations.

**Solution**: 
1. **Hybrid Memory System**: 
   - **Redis Memory**: Always used for recent conversations (last 10 messages) - fast and efficient
   - **Memory Tool**: Used for long-term storage with periodic embedding every 10 messages
2. **Periodic Embedding**: 
   - Embed messages every 10 messages (10, 20, 30, etc.)
   - Prevents duplicate embedding by checking message IDs
   - Efficient resource usage
3. **Enhanced Prompt Templates**: Modified `backend/agents/prompt_factory.py` to explicitly instruct agents that chat history is context, not questions to answer.
4. **Improved System Prompts**: Updated all agent templates in `backend/services/agent_service.py` to include clear instructions about using chat history as context.
5. **Memory Tool Features**:
   - Uses Bedrock embeddings for semantic search
   - Stores chat history in ChromaDB collections
   - Two tools: search_memory and get_recent_context
   - Agent can search through history using natural language
   - Automatic cleanup when chats are deleted
6. **Memory Management**: Added automatic memory clearing when:
   - Creating new chat sessions
   - Switching between chat sessions
   - Changing agents
   - Deleting chats
7. **Manual Memory Control**: Added `/chat/{chat_id}/clear-memory` endpoint for manual memory clearing.
8. **Memory Statistics**: Added `/chat/memory/stats` endpoint for admin monitoring.

**Key Changes**:
- `backend/agents/tool_registry.py`: Added ChatMemoryTool with periodic embedding and duplicate prevention
- `backend/agents/prompt_factory.py`: Added context instructions to prompt template
- `backend/services/chat_service.py`: Added periodic embedding system and hybrid approach
- `backend/routes/chat.py`: Added automatic memory clearing and memory stats endpoint
- `backend/services/agent_service.py`: Updated all agent system prompts

**Result**: 
- Agents now properly understand that memory is context for better responses, not questions to answer
- Efficient memory management with periodic embedding every 10 messages
- Redis memory always available for recent context
- Semantic search through chat history for better context retrieval
- Reduced memory usage and improved performance
- No duplicate embedding of messages

## Backend Architecture

### **Python Backend (FastAPI)**
- **Location**: `backend/`
- **Status**: Production-ready
- **Features**: Basic AI chat, memory system, agent tools
- **Technology**: FastAPI, Celery, Redis, MongoDB

### **Node.js Backend (NestJS)**
- **Location**: `backend-node/`
- **Status**: Phase 1 Complete, Phase 2 Complete
- **Features**: Advanced WebSocket, Agent orchestration, Type safety
- **Technology**: NestJS, Socket.IO, BullMQ, TypeScript
- **Progress**: 
  - ✅ **Phase 1**: Core systems (23 modules implemented)
  - ✅ **Phase 2**: Advanced features (WebSocket, Agent orchestration, Vector embeddings)
  - ⏳ **Phase 3**: Performance & scalability

### **Migration Status**
- **Core Functionality**: ✅ Completed
- **WebSocket Features**: ✅ Implemented
- **Agent Orchestration**: ✅ Implemented
- **Type Safety**: ✅ Completed (Zod validation implemented)
- **Token-by-Token Streaming**: ✅ Completed (Real-time AI response streaming)
- **Error Handling Enhancement**: ✅ Completed (Global exception handling, retry, circuit breaker)
- **Vector Embeddings**: ✅ Completed (Semantic search, similarity matching, intelligent caching)

## Features 