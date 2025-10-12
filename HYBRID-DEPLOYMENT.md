# Hybrid Deployment: Docker Compose + Kubernetes

## สถาปัตยกรรม (Architecture)

```
Load Balancer (10.1.4.6)
    ↓
Host NGINX (10.1.44.204:80) ← จุดรวมทุกอย่าง
    ├─→ /api/*  → Kubernetes Ingress (localhost:8080)
    │               ├→ Auth Service (K8s)
    │               ├→ Chat Service (K8s)
    │               ├→ Agent Service (K8s)
    │               └→ Other microservices (K8s)
    │
    ├─→ /ws     → Kubernetes Ingress (localhost:8080)
    │               └→ WebSocket services (K8s)
    │
    ├─→ /minio/ → MinIO (Docker Compose)
    │
    └─→ /       → Frontend (Docker Compose)
                    └→ Static files served by NGINX
```

## ข้อดี

✅ **Best of Both Worlds:**
- ใช้ **Kubernetes** สำหรับ microservices (scalable, easy deployment)
- ใช้ **Docker Compose** สำหรับ infrastructure (MongoDB, Redis, MinIO) และ Frontend
- ไม่ต้องย้ายทุกอย่างไป Kubernetes ในครั้งเดียว

✅ **ทำงานได้ทันที:**
- Docker Compose Frontend ทำงานได้อยู่แล้ว
- ไม่ต้องรอ IT admin แก้ load balancer

✅ **Easy to Maintain:**
- แก้ frontend → แก้ใน Docker Compose
- แก้ microservices → แก้ใน Kubernetes

---

## ขั้นตอนการ Deploy

### 1. Backup Config เดิม

```bash
cd ~/MFULearnAi
cp nginx/nginx.conf nginx/nginx.conf.backup.$(date +%Y%m%d)
```

### 2. Apply Config ใหม่

```bash
# Copy hybrid config
cp nginx/nginx-hybrid.conf nginx/nginx.conf
```

### 3. Start Frontend (Docker Compose)

```bash
cd ~/MFULearnAi

# Start frontend only
docker-compose up -d frontend

# ตรวจสอบ
docker ps | grep frontend
```

### 4. Start NGINX Container

```bash
# Start nginx with the hybrid config
docker-compose up -d nginx

# Check logs
docker logs mfulearnai_nginx -f
```

### 5. ทดสอบ

```bash
# Test frontend (Docker Compose)
curl -I http://localhost:80/

# Test API (Kubernetes)
curl -I http://localhost:80/api/auth/health

# Test from localhost
curl -I http://localhost/
```

### 6. แจ้ง IT Admin แก้ Load Balancer

ส่งข้อมูลนี้ให้ IT admin ที่ดูแล load balancer (10.1.4.6):

**ให้แก้ NGINX config บน 10.1.4.6:**

```nginx
# เปลี่ยนจาก:
proxy_pass https://10.1.44.204:8443;

# เป็น:
proxy_pass http://10.1.44.204:80;
```

**เพียงเท่านี้!** Load balancer จะ proxy ไปที่ port 80 ของ host NGINX ที่เราเพิ่งตั้งค่าไว้

---

## การทดสอบหลัง Deploy

### Test 1: Frontend Load

```bash
curl -I https://mfulearnai.mfu.ac.th/
# Expected: HTTP/2 200 (no redirect loop)
```

### Test 2: API Endpoints

```bash
curl -I https://mfulearnai.mfu.ac.th/api/auth/health
# Expected: HTTP/2 200
```

### Test 3: WebSocket

```bash
# ใช้ browser console
ws = new WebSocket('wss://mfulearnai.mfu.ac.th/ws')
# Expected: Connection successful
```

---

## Troubleshooting

### ปัญหา: Frontend ไม่โหลด

```bash
# Check frontend container
docker ps | grep frontend
docker logs mfulearnai_frontend

# Restart frontend
docker-compose restart frontend
```

### ปัญหา: API ไม่ตอบ

```bash
# Check Kubernetes pods
kubectl get pods -n mfulearnai

# Check Kubernetes Ingress
curl -I http://localhost:8080/api/auth/health
```

### ปัญหา: NGINX ไม่ทำงาน

```bash
# Check nginx container
docker logs mfulearnai_nginx

# Test nginx config
docker exec mfulearnai_nginx nginx -t

# Restart nginx
docker-compose restart nginx
```

---

## Rollback

ถ้ามีปัญหา rollback ได้ทันที:

```bash
cd ~/MFULearnAi

# Restore old config
cp nginx/nginx.conf.backup.YYYYMMDD nginx/nginx.conf

# Restart nginx
docker-compose restart nginx
```

---

## Services Mapping

| URL Path | Service | Technology | Port |
|----------|---------|------------|------|
| `/` | Frontend | Docker Compose | 80 |
| `/api/auth/*` | Auth Service | Kubernetes | 8080 |
| `/api/chat/*` | Chat Service | Kubernetes | 8080 |
| `/api/agents/*` | Agent Service | Kubernetes | 8080 |
| `/ws` | WebSocket | Kubernetes | 8080 |
| `/minio/*` | MinIO Storage | Docker Compose | 9000 |

---

## Future Migration (ถ้าต้องการ)

ในอนาคตถ้าต้องการย้าย Frontend ไป Kubernetes:

1. Frontend อยู่ใน Kubernetes แล้ว (เราสร้างไว้แล้ว)
2. แค่แก้ `nginx-hybrid.conf`:
   ```nginx
   # เปลี่ยน upstream frontend จาก
   upstream frontend {
       server frontend:80;  # Docker Compose
   }

   # เป็น
   upstream frontend {
       server localhost:8080;  # Kubernetes
   }
   ```
3. Stop Docker Compose frontend
4. Restart NGINX

---

## สรุป

ระบบนี้ใช้ **Hybrid Architecture** ที่:
- **Kubernetes** จัดการ microservices (scalable, easy to update)
- **Docker Compose** จัดการ infrastructure และ frontend (stable, working)
- **Host NGINX** เป็นตัวกลางที่รวมทุกอย่าง

**ไม่ต้องเลือกอย่างใดอย่างหนึ่ง - ใช้ทั้งสองอย่างร่วมกันได้!** 🚀
