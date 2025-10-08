# 🔍 Port Analysis & Conflict Resolution

## Current Port Usage Summary

### Docker Compose (Existing System)
| Service | External Port | Internal Port | Status |
|---------|---------------|---------------|--------|
| MongoDB | 27017 | 27017 | ✅ OK |
| Redis | 6379 | 6379 | ✅ OK |
| Backend (Monolith) | 3001 | 3001 | ⚠️ **CONFLICT** with Department Service |
| Frontend | - | 80 | ✅ OK |
| Nginx | 80, 443 | 80, 443 | ✅ OK |
| ChromaDB | 8000 | 8000 | ⚠️ **CONFLICT** with Bedrock Gateway internal |
| MinIO API | 9000 | 9000 | ✅ OK |
| MinIO Console | 9001 | 9001 | ✅ OK |
| Bedrock Gateway | 8001 | 8000 | ✅ OK (mapped to 8001 externally) |
| Prometheus | 9090 | 9090 | ✅ OK |
| MongoDB Exporter | 9216 | 9216 | ✅ OK |
| Grafana | 3000 | 3000 | ⚠️ **CONFLICT** with Auth Service |

---

### Kubernetes Microservices (New System)
| Service | K8s Port | External (if exposed) | Notes |
|---------|----------|----------------------|-------|
| **Auth Service** | 3000 | - | ⚠️ Conflicts with Grafana |
| **Department Service** | 3001 | - | ⚠️ Conflicts with Backend monolith |
| **Chat Service** | 3002 | - | ✅ OK - No conflict |
| **Agent Service** | 3003 | - | ✅ OK - No conflict |
| **RAG Service** | 3004 | - | ✅ OK - No conflict |
| **Training Service** | 3005 | - | ✅ OK - No conflict |
| **Storage Service** | 3006 | - | ✅ OK - No conflict |
| **Bedrock Gateway** | 8000 | - | ⚠️ Internal conflict with ChromaDB |
| **API Gateway** | 8080 | 80/443 (via Ingress) | ✅ OK |

---

## 🎯 Resolution Strategy

### **Scenario 1: Running Docker Compose AND Kubernetes Together (NOT RECOMMENDED)**

If you need both systems running simultaneously:

#### Port Remapping Required:
1. **Auth Service**: Change to 3010 (avoid Grafana 3000)
2. **Department Service**: Keep 3001 (will conflict with backend monolith - choose one)
3. **Bedrock Gateway**: Already resolved (Docker uses 8001, K8s uses 8000 internally)

#### Steps:
```bash
# Option A: Stop Docker Compose services
docker-compose down

# Option B: Remap ports in K8s services
# Edit each deployment.yaml to use different ports
```

---

### **Scenario 2: Migrate from Docker Compose to Kubernetes (RECOMMENDED)**

This is the **recommended approach** for production:

#### Migration Plan:
1. **Stop Docker Compose services**:
   ```bash
   docker-compose down
   ```

2. **Deploy Kubernetes infrastructure first**:
   - MongoDB (27017) ✅
   - Redis (6379) ✅
   - ChromaDB (8000) ✅
   - MinIO (9000, 9001) ✅

3. **Deploy microservices**:
   - All services run on their designated ports
   - No conflicts because Docker Compose is stopped

4. **Access via Ingress**:
   - All external traffic goes through API Gateway (port 8080)
   - Ingress controller maps to 80/443
   - Internal services communicate via Kubernetes DNS

#### Benefits:
- ✅ No port conflicts
- ✅ Service discovery via DNS
- ✅ Proper microservices architecture
- ✅ Horizontal scaling
- ✅ Health checks & self-healing

---

### **Scenario 3: Hybrid Approach (Development Only)**

Keep infrastructure in Docker Compose, run services in Kubernetes:

#### Docker Compose (Infrastructure Only):
```yaml
services:
  db:
    ports: ["27017:27017"]
  redis:
    ports: ["6379:6379"]
  chroma:
    ports: ["8000:8000"]
  minio:
    ports: ["9000:9000", "9001:9001"]
```

#### Kubernetes (Services Only):
- Configure services to connect to host machine's Docker services
- Use `host.docker.internal` or node IP for connections

---

## 🚨 Identified Port Conflicts

### **Critical Conflicts (Must Resolve):**

1. **Port 3000**:
   - Docker: Grafana
   - K8s: Auth Service
   - **Resolution**: Stop Grafana or remap Auth Service to 3010

2. **Port 3001**:
   - Docker: Backend Monolith
   - K8s: Department Service
   - **Resolution**: This is expected - microservices replace monolith

3. **Port 8000**:
   - Docker: ChromaDB (exposed)
   - K8s: Bedrock Gateway (internal), ChromaDB (internal)
   - **Resolution**: Already handled - Docker exposes on 8001

---

## ✅ Recommended Action Plan

### For Production Deployment:

```bash
# 1. Backup current data
docker-compose exec db mongodump --out=/backup

# 2. Stop Docker Compose
docker-compose down

# 3. Deploy Kubernetes (no conflicts)
cd k8s
./deploy-all-services.sh

# 4. Restore data to Kubernetes MongoDB
kubectl exec -it mongodb-0 -n mfulearnai-core -- mongorestore /backup
```

### For Development (Keep Both):

```bash
# 1. Remap conflicting K8s services
# Edit deployments to use alternative ports:
# - auth-service: 3010 (instead of 3000)
# - department-service: 3011 (instead of 3001)

# 2. Update API Gateway routes to match new ports

# 3. Deploy to Kubernetes
cd k8s
./deploy-all-services.sh
```

---

## 📊 Final Port Map (Kubernetes Only - Recommended)

| Service | Internal Port | Exposed Via | External Access |
|---------|---------------|-------------|-----------------|
| API Gateway | 8080 | Ingress | https://mfulearnai.mfu.ac.th |
| Auth Service | 3000 | ClusterIP | Internal only |
| Department Service | 3001 | ClusterIP | Internal only |
| Chat Service | 3002 | ClusterIP | Internal only |
| Agent Service | 3003 | ClusterIP | Internal only |
| RAG Service | 3004 | ClusterIP | Internal only |
| Training Service | 3005 | ClusterIP | Internal only |
| Storage Service | 3006 | ClusterIP | Internal only |
| Bedrock Gateway | 8000 | ClusterIP | Internal only |
| MongoDB | 27017 | StatefulSet | Internal only |
| Redis | 6379 | Deployment | Internal only |
| ChromaDB | 8000 | Deployment | Internal only |
| MinIO API | 9000 | Deployment | Internal only |
| MinIO Console | 9001 | NodePort | http://node-ip:9001 |
| Prometheus | 9090 | Deployment | Internal only |
| Grafana | 3000 | NodePort | http://node-ip:3000 |

---

## 🎯 Conclusion

**RECOMMENDED**: Deploy full Kubernetes stack and stop Docker Compose to avoid all conflicts.

All ports are properly allocated with no conflicts in Kubernetes-only deployment.
