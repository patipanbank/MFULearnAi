# Deployment Instructions

## คำสั่ง Deploy สำหรับ mfulearnai@10.1.44.204

### 1. SSH เข้า Server

```bash
ssh mfulearnai@10.1.44.204
```

### 2. Pull Code ล่าสุด

```bash
cd ~/MFULearnAi
git pull origin kube
```

### 3. Build Docker Images

#### Build chat-service

```bash
cd ~/MFULearnAi/services/chat-service
docker build -t localhost:5000/chat-service:latest .
```

#### Build frontend

```bash
cd ~/MFULearnAi/frontend
docker build -t localhost:5000/frontend:latest .
```

### 4. Push Images to Registry

```bash
docker push localhost:5000/chat-service:latest
docker push localhost:5000/frontend:latest
```

### 5. Deploy to Kubernetes

```bash
# Deploy chat-service
kubectl set image deployment/chat-service \
  chat-service=localhost:5000/chat-service:latest \
  -n mfu-learn-ai

# Deploy frontend
kubectl set image deployment/frontend \
  frontend=localhost:5000/frontend:latest \
  -n mfu-learn-ai
```

### 6. รอ Rollout เสร็จ

```bash
kubectl rollout status deployment/chat-service -n mfu-learn-ai
kubectl rollout status deployment/frontend -n mfu-learn-ai
```

### 7. ตรวจสอบ Pods

```bash
kubectl get pods -n mfu-learn-ai
```

### 8. ดู Logs (ถ้ามีปัญหา)

```bash
# Chat service logs
kubectl logs -n mfu-learn-ai -l app.kubernetes.io/name=chat-service --tail=50

# Frontend logs
kubectl logs -n mfu-learn-ai -l app.kubernetes.io/name=frontend --tail=50
```

---

## One-Line Command (All in One)

```bash
cd ~/MFULearnAi && \
git pull origin kube && \
cd services/chat-service && docker build -t localhost:5000/chat-service:latest . && \
cd ../../frontend && docker build -t localhost:5000/frontend:latest . && \
docker push localhost:5000/chat-service:latest && \
docker push localhost:5000/frontend:latest && \
kubectl set image deployment/chat-service chat-service=localhost:5000/chat-service:latest -n mfu-learn-ai && \
kubectl set image deployment/frontend frontend=localhost:5000/frontend:latest -n mfu-learn-ai && \
kubectl rollout status deployment/chat-service -n mfu-learn-ai && \
kubectl rollout status deployment/frontend -n mfu-learn-ai && \
kubectl get pods -n mfu-learn-ai
```

---

## Changes Deployed

### Chat Service Improvements
- ✅ Added `create_room` WebSocket handler
- ✅ Added validation for `join_room`
- ✅ Improved error handling and logging
- ✅ Better TypeScript types

### Frontend Improvements
- ✅ Fixed user profile display issues
- ✅ Added `normalizeUser()` for MongoDB format compatibility
- ✅ Created comprehensive User Profile page
- ✅ Added WebSocketManager class with:
  - Exponential backoff reconnection
  - Message queueing
  - Heartbeat mechanism
- ✅ Added TypeScript type definitions for WebSocket messages

---

## Verification

### 1. Check Application

Visit: `http://10.1.44.204`

### 2. Test User Profile

1. Login via SAML
2. Click Settings (bottom of sidebar)
3. Select "My Profile"
4. Verify all user data displays correctly

### 3. Test Chat

1. Create new chat
2. Send message
3. Verify WebSocket connection stable
4. Check message streaming works

---

## Troubleshooting

### Pods not starting

```bash
kubectl describe pod <pod-name> -n mfu-learn-ai
kubectl logs <pod-name> -n mfu-learn-ai
```

### Build failures

```bash
# Check Docker daemon
docker ps

# Check registry
curl -X GET http://localhost:5000/v2/_catalog
```

### Deployment issues

```bash
# Check deployment status
kubectl get deployments -n mfu-learn-ai

# Rollback if needed
kubectl rollout undo deployment/chat-service -n mfu-learn-ai
kubectl rollout undo deployment/frontend -n mfu-learn-ai
```

---

## Expected Result

After successful deployment:

- ✅ User profile page shows complete user information
- ✅ WebSocket connections are stable
- ✅ Chat messages stream properly
- ✅ Auto-reconnect works when connection drops
- ✅ No console errors in browser dev tools

---

**Last Updated:** 2025-01-24
**Deployed Services:**
- chat-service:latest
- frontend:latest
