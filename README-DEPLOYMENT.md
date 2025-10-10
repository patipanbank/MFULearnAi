# 🎯 วิธี Deploy LangGraph Agent - สำหรับคุณ

## ✅ ทุกอย่างพร้อมแล้ว!

ฉันได้:
1. ✅ Refactor agent service ให้ใช้ LangGraph
2. ✅ Build และ test สำเร็จแล้ว
3. ✅ Push code ไปที่ git branch `kubernetes`
4. ✅ สร้าง deployment scripts หลายแบบ
5. ✅ เขียนเอกสารครบถ้วน
6. ✅ ตรวจสอบ frontend และ backend ทั้งหมด

**ตอนนี้คุณต้องทำแค่ deploy!**

---

## 🚀 วิธีที่ง่ายที่สุด (แนะนำ)

### ขั้นตอนที่ 1: SSH เข้า Server

เปิด Terminal/PowerShell และพิมพ์:
```bash
ssh mfulearnai@10.1.44.204
```

### ขั้นตอนที่ 2: Copy & Paste คำสั่งนี้ทั้งหมด

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

### ขั้นตอนที่ 3: รอจนเสร็จ

จะใช้เวลาประมาณ 5-7 นาที

คุณจะเห็น:
```
📥 Pulling code...
✅ Code updated
📦 Installing...
✅ Installed
🔨 Building...
✅ Built
🔄 Restarting...
✅ DEPLOYMENT COMPLETE!
```

### ขั้นตอนที่ 4: ตรวจสอบ

```bash
docker logs -f agent-service
```

หา log แบบนี้:
```
✅ LangGraph agent compiled successfully
🏗️ Building LangGraph StateGraph
Agent Service running on port 3003
```

กด `Ctrl+C` เพื่อออกจากการดู logs

---

## ✅ เช็คว่า Deploy สำเร็จ

### 1. เช็ค Container
```bash
docker ps | grep agent-service
```
ต้องเห็น container กำลัง run (Status: Up)

### 2. เช็ค Health
```bash
curl http://localhost:3003/health
```
ต้องได้ `{"status":"healthy"}`

### 3. เช็ค LangGraph
```bash
docker logs agent-service | grep -i langgraph | tail -3
```
ต้องเห็นข้อความเกี่ยวกับ LangGraph

---

## 🎊 เสร็จแล้ว!

เมื่อ deploy สำเร็จ:
- ✅ Agent service ใช้ LangGraph architecture แล้ว
- ✅ Streaming ทำงานแบบ native
- ✅ State management ดีขึ้น
- ✅ Debugging ง่ายขึ้น
- ✅ Chat frontend ทำงานได้เหมือนเดิม (ไม่ต้องแก้อะไร)

---

## 📚 เอกสารเพิ่มเติม

ถ้าต้องการรายละเอียดเพิ่มเติม:

1. **[HOW-TO-DEPLOY.md](HOW-TO-DEPLOY.md)** - วิธี deploy ทุกแบบ
2. **[DEPLOYMENT.md](DEPLOYMENT.md)** - เอกสาร deployment ฉบับเต็ม
3. **[DEPLOYMENT-SUMMARY.md](DEPLOYMENT-SUMMARY.md)** - สรุปงานทั้งหมด

---

## ❓ ถ้ามีปัญหา

### Build ล้มเหลว
```bash
cd MFULearnAi/k8s/services/agent-service
rm -rf node_modules dist
npm install
npm run build
```

### Container ไม่ start
```bash
docker logs agent-service --tail 50
docker-compose restart agent-service
```

### ต้องการ Rollback
```bash
cd MFULearnAi
git checkout HEAD~1
cd k8s/services/agent-service
npm install && npm run build
cd ~/MFULearnAi
docker-compose up -d agent-service
```

---

## 🔄 วิธีอื่นๆ (Optional)

### ใช้ Script
```bash
cd MFULearnAi
chmod +x deploy-langgraph.sh
./deploy-langgraph.sh
```

### Manual Step-by-Step
ดูใน [HOW-TO-DEPLOY.md](HOW-TO-DEPLOY.md)

---

## 💡 TL;DR

```bash
# 1. SSH เข้าไป
ssh mfulearnai@10.1.44.204

# 2. Copy-paste คำสั่งจาก "ขั้นตอนที่ 2" ด้านบน

# 3. รอจนเสร็จ (~7 นาที)

# 4. เช็คว่า OK
docker ps | grep agent-service

# 5. เสร็จ! 🎉
```

---

**ถ้าคุณทำตามนี้ จะ deploy สำเร็จแน่นอน!**

มีคำถามอะไรถามได้เลยครับ 😊
