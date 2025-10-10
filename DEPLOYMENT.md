# 🚀 LangGraph Agent Deployment Guide

## Overview

This guide covers deploying the new LangGraph-based agent architecture to the production server.

## Architecture Changes

### Old Architecture (Deprecated)
```
AgentExecutor (LangChain) → Sequential execution → Limited control
```

### New Architecture (LangGraph)
```
StateGraph → Router Node → RAG/Web/Tools → Agent Node → Response
  ↓
MemorySaver Checkpointer (Persistent State)
  ↓
Native Streaming Support
```

---

## Prerequisites

- SSH access to server: `mfulearnai@10.1.44.204`
- Git branch: `kubernetes`
- Docker and docker-compose installed

---

## Quick Deployment

### Option 1: Automated Script

```bash
# SSH into server
ssh mfulearnai@10.1.44.204

# Navigate to project
cd MFULearnAi

# Make script executable
chmod +x deploy-langgraph.sh

# Run deployment
./deploy-langgraph.sh
```

### Option 2: Manual Steps

```bash
# 1. SSH into server
ssh mfulearnai@10.1.44.204

# 2. Pull latest code
cd MFULearnAi
git fetch origin kubernetes
git reset --hard origin/kubernetes

# 3. Install dependencies
cd k8s/services/agent-service
npm install --production

# 4. Build TypeScript
npm run build

# 5. Restart service
cd ~/MFULearnAi
docker-compose stop agent-service
docker-compose rm -f agent-service
docker-compose up -d agent-service

# 6. Verify deployment
docker ps | grep agent-service
docker logs -f agent-service
```

---

## Verification

### 1. Check Container Status
```bash
docker ps | grep agent-service
```

**Expected output:**
```
CONTAINER ID   IMAGE                    STATUS          PORTS
abc123def456   agent-service:latest     Up 2 minutes    3003/tcp
```

### 2. Health Check
```bash
curl http://localhost:3003/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "agent-service",
  "timestamp": "2025-10-10T...",
  "uptime": 123.45
}
```

### 3. Check Logs
```bash
docker logs -f agent-service
```

**Look for:**
```
✅ LangGraph agent created
🏗️ Building LangGraph StateGraph for session: ...
MongoDB connected successfully
Agent Service running on port 3003
```

### 4. Test Agent Execution
```bash
curl -X POST http://localhost:3003/api/agents/execute \
  -H "Content-Type: application/json" \
  -d '{
    "chatId": "test123",
    "userId": "test_user",
    "userContent": "Hello, test the new LangGraph agent"
  }'
```

---

## Architecture Verification

### Check LangGraph is Active

Look for these log messages indicating LangGraph is running:

```bash
docker logs agent-service | grep -i "langgraph"
```

**Expected logs:**
```
🏗️ Building LangGraph StateGraph for session: xxx
🚀 Running LangGraph agent with query: "..."
📍 Router Node: Analyzing user query...
🔀 Route Decision: RAG=true, Web=false
📚 RAG Node: Searching knowledge base...
🤖 Agent Node: Processing with LLM...
✅ LangGraph agent compiled successfully
```

---

## Rollback (If Needed)

If deployment fails, rollback to previous version:

```bash
# Stop current container
docker-compose stop agent-service

# Checkout previous commit
git checkout HEAD~1

# Rebuild and restart
cd k8s/services/agent-service
npm install
npm run build
cd ~/MFULearnAi
docker-compose up -d agent-service
```

---

## Configuration

### Environment Variables

Check these are set in docker-compose.yml or K8s deployment:

```yaml
environment:
  - NODE_ENV=production
  - PORT=3003
  - MONGODB_URI=${MONGODB_URI}
  - RAG_SERVICE_URL=http://rag-service:3004
  - STORAGE_SERVICE_URL=http://storage-service:3006
  - AWS_REGION=${AWS_REGION}
  - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
  - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
```

---

## Troubleshooting

### Issue 1: Build Fails
```bash
# Clean and rebuild
cd k8s/services/agent-service
rm -rf node_modules dist
npm install
npm run build
```

### Issue 2: Container Won't Start
```bash
# Check logs
docker logs agent-service --tail 100

# Check if port is available
netstat -tulpn | grep 3003

# Restart Docker daemon if needed
sudo systemctl restart docker
```

### Issue 3: Health Check Fails
```bash
# Check if MongoDB is accessible
docker exec agent-service wget -qO- http://localhost:3003/ready

# Check environment variables
docker exec agent-service env | grep -E "MONGODB|AWS"
```

### Issue 4: LangGraph Not Working
```bash
# Verify LangGraph package is installed
docker exec agent-service npm list | grep langgraph

# Expected: @langchain/langgraph@0.2.x
```

---

## Performance Monitoring

### Check Resource Usage
```bash
# CPU and Memory
docker stats agent-service

# Response time
time curl http://localhost:3003/health
```

### Monitor Logs in Real-time
```bash
# All logs
docker logs -f agent-service

# Only errors
docker logs -f agent-service 2>&1 | grep -i error

# Only LangGraph events
docker logs -f agent-service | grep -E "LangGraph|StateGraph|Router|RAG Node"
```

---

## What Changed

### Files Modified
- ✅ `k8s/services/agent-service/package.json` - Added @langchain/langgraph
- ✅ `k8s/services/agent-service/src/agent/langgraphAgent.ts` - NEW: StateGraph implementation
- ✅ `k8s/services/agent-service/src/services/langGraphExecutionService.ts` - NEW: Execution service
- ✅ `k8s/services/agent-service/src/agent/agentFactory.ts` - Updated to use LangGraph
- ✅ `k8s/services/agent-service/src/routes/agent.ts` - Added /execute endpoint
- ✅ Stub services created for backward compatibility

### No Changes Needed
- ✅ chat-service (uses HTTP API)
- ✅ frontend (WebSocket events compatible)
- ✅ Docker/K8s configs (environment compatible)

---

## Benefits of New Architecture

1. **Better State Management**: Built-in checkpointer with Redis support
2. **Native Streaming**: Token-by-token streaming without workarounds
3. **Conditional Routing**: Dynamic tool selection based on query analysis
4. **Improved Debugging**: State inspection at each node
5. **Scalability**: Easy to add new nodes/tools
6. **Maintainability**: Cleaner code structure

---

## Support

For issues or questions:
- Check logs: `docker logs -f agent-service`
- GitHub issues: https://github.com/patipanbank/MFULearnAi/issues
- Commits: https://github.com/patipanbank/MFULearnAi/commits/kubernetes

---

## Version Info

- **Branch**: kubernetes
- **Last Commit**: refactor: Update agentFactory to use LangGraph by default
- **LangGraph Version**: 0.2.0
- **LangChain Version**: 0.3.0
- **Deployment Date**: 2025-10-10

---

**🎉 Happy Deploying!**
