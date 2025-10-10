# 🚀 วิธี Deploy LangGraph Agent - สรุปทุกวิธี

เนื่องจาก SSH connection จาก local มีปัญหา timeout มีหลายวิธีในการ deploy:

---

## 🎯 วิธีที่ 1: One-Command Deploy (แนะนำที่สุด!)

### คำสั่งเดียว - Copy & Paste ใน SSH Terminal

```bash
ssh mfulearnai@10.1.44.204
```

จากนั้น copy คำสั่งด้านล่างนี้ทั้งหมดไปวาง:

```bash
cd MFULearnAi && \
echo "📥 Pulling code..." && \
git fetch origin kubernetes && \
git reset --hard origin/kubernetes && \
echo "✅ Code updated" && \
echo "" && \
echo "📦 Installing..." && \
cd k8s/services/agent-service && \
npm install --production && \
echo "✅ Installed" && \
echo "" && \
echo "🔨 Building..." && \
npm run build && \
echo "✅ Built" && \
echo "" && \
echo "🔄 Restarting..." && \
cd ~/MFULearnAi && \
docker-compose stop agent-service && \
docker-compose rm -f agent-service && \
docker-compose up -d agent-service && \
sleep 10 && \
echo "" && \
echo "✅ DEPLOYMENT COMPLETE!" && \
echo "" && \
docker ps | grep agent-service && \
echo "" && \
echo "View logs: docker logs -f agent-service"
```

**ระยะเวลา:** ~5-7 นาที

---

## 🎯 วิธีที่ 2: ใช้ Deployment Script (Auto)

### ใน SSH Terminal:

```bash
ssh mfulearnai@10.1.44.204
cd MFULearnAi
git pull origin kubernetes
chmod +x deploy-langgraph.sh
./deploy-langgraph.sh
```

**ระยะเวลา:** ~5-7 นาที
**ข้อดี:** มี color output และ progress indicator

---

## 🎯 วิธีที่ 3: Manual Step-by-Step

### ใน SSH Terminal:

```bash
# 1. SSH
ssh mfulearnai@10.1.44.204

# 2. Pull code
cd MFULearnAi
git fetch origin kubernetes
git reset --hard origin/kubernetes

# 3. Install
cd k8s/services/agent-service
npm install --production

# 4. Build
npm run build

# 5. Restart
cd ~/MFULearnAi
docker-compose stop agent-service
docker-compose rm -f agent-service
docker-compose up -d agent-service

# 6. Verify
docker ps | grep agent-service
docker logs -f agent-service
```

**ระยะเวลา:** ~5-7 นาที
**ข้อดี:** ควบคุมได้ทุกขั้นตอน

---

## 🎯 วิธีที่ 4: Windows Batch File

### Double-click file นี้:
```
C:\Users\User\Documents\GitHub\MFULearnAi\deploy.bat
```

หรือใน Command Prompt:
```cmd
cd C:\Users\User\Documents\GitHub\MFULearnAi
deploy.bat
```

**หมายเหตุ:** ต้องมี SSH keys setup แล้ว

---

## ✅ การตรวจสอบหลัง Deploy

### 1. Check Container Status
```bash
ssh mfulearnai@10.1.44.204 "docker ps | grep agent-service"
```

**ผลลัพธ์ที่ต้องการ:**
```
abc123  agent-service:latest  Up 2 minutes  3003/tcp
```

### 2. Health Check
```bash
ssh mfulearnai@10.1.44.204 "curl -s http://localhost:3003/health"
```

**ผลลัพธ์ที่ต้องการ:**
```json
{"status":"healthy","service":"agent-service"}
```

### 3. Check LangGraph Logs
```bash
ssh mfulearnai@10.1.44.204 "docker logs agent-service | grep -i langgraph | tail -5"
```

**ผลลัพธ์ที่ต้องการ:**
```
✅ LangGraph agent compiled successfully
🏗️ Building LangGraph StateGraph
📍 Router Node: Analyzing user query...
```

### 4. View Live Logs
```bash
ssh mfulearnai@10.1.44.204 "docker logs -f agent-service"
```

กด `Ctrl+C` เพื่อออก

---

## 🔧 Troubleshooting

### ปัญหา: Build Failed
```bash
ssh mfulearnai@10.1.44.204
cd MFULearnAi/k8s/services/agent-service
rm -rf node_modules dist
npm install
npm run build
```

### ปัญหา: Container Won't Start
```bash
ssh mfulearnai@10.1.44.204
docker logs agent-service --tail 100
docker-compose restart agent-service
```

### ปัญหา: Port Already in Use
```bash
ssh mfulearnai@10.1.44.204
docker-compose stop agent-service
docker ps -a | grep agent-service
docker rm -f $(docker ps -aq --filter "name=agent-service")
docker-compose up -d agent-service
```

---

## 🔄 Rollback

ถ้าต้องการ rollback:

```bash
ssh mfulearnai@10.1.44.204
cd MFULearnAi
git checkout HEAD~1
cd k8s/services/agent-service
npm install && npm run build
cd ~/MFULearnAi
docker-compose up -d agent-service
```

---

## 📊 What Was Deployed

### New Features:
- ✅ **LangGraph StateGraph** - Modern agent architecture
- ✅ **Native Streaming** - Token-by-token responses
- ✅ **Conditional Routing** - Smart tool selection
- ✅ **State Management** - Built-in checkpointer
- ✅ **Better Debugging** - State inspection at each node

### Files Changed:
- `k8s/services/agent-service/src/agent/langgraphAgent.ts` (NEW)
- `k8s/services/agent-service/src/services/langGraphExecutionService.ts` (NEW)
- `k8s/services/agent-service/src/agent/agentFactory.ts` (UPDATED)
- `k8s/services/agent-service/src/routes/agent.ts` (UPDATED)
- `k8s/services/agent-service/package.json` (UPDATED)

### Backward Compatibility:
- ✅ chat-service (no changes needed)
- ✅ frontend (no changes needed)
- ✅ Docker/K8s configs (compatible)
- ✅ Database schema (unchanged)

---

## 📞 Support

หากมีปัญหา:
1. ดู logs: `docker logs -f agent-service`
2. ตรวจสอบ health: `curl http://localhost:3003/health`
3. Restart: `docker-compose restart agent-service`

---

## 🎉 Success Indicators

เมื่อ deploy สำเร็จ คุณจะเห็น:

1. ✅ Container running (docker ps)
2. ✅ Health check returns "healthy"
3. ✅ Logs show "LangGraph agent compiled"
4. ✅ No error messages in logs
5. ✅ Chat frontend ทำงานปกติ

---

**Git Branch:** `kubernetes`
**Commit:** refactor: Update agentFactory to use LangGraph by default
**Date:** 2025-10-10

**🚀 Happy Deploying!**
