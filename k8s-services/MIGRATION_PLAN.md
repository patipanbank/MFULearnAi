# K8s Microservices Migration Plan

## 🎯 Overview

Incremental migration from Docker Compose monolith to K8s microservices.

**Strategy:** Build new services independently, migrate Nginx when 5+ services are ready.

---

## 📊 Service Priority Matrix

| Priority | Service | Complexity | Dependencies | Status |
|----------|---------|------------|--------------|--------|
| 1 | **Auth Service** | Medium | MongoDB | ✅ **DEPLOYED** |
| 2 | **Department Service** | Low | MongoDB | 📋 Next |
| 3 | **Chat Service** | High | MongoDB, Redis, WebSocket | 🔜 Plan |
| 4 | **RAG Service** | High | ChromaDB, Embeddings | 🔜 Plan |
| 5 | **Training Service** | Medium | MongoDB, MinIO, RAG | 🔜 Plan |
| 6 | **Agent Service** | High | LangChain, Tools, RAG | 🔜 Plan |
| 7 | **Admin Service** | Low | MongoDB, All Services | 🔜 Plan |
| 8 | **Nginx Ingress** | Medium | All Services | 🔜 Last |

---

## ✅ Phase 1: Foundation (COMPLETED)

### Auth Service
- **Status:** ✅ Deployed & Running
- **Pods:** 2/2 healthy
- **Endpoints:** All working
- **Traffic:** Via backend monolith (temporary)

**Lessons Learned:**
- Kind cluster networking isolated from Docker Compose
- Need full K8s migration for traffic routing
- Multi-stage builds reduce image size
- Auto-scaling works well

---

## 📋 Phase 2: Core Services (CURRENT)

### Next: Department Service

**Why Department Service?**
- ✅ Lowest complexity
- ✅ Auth service already calls it
- ✅ Small codebase (~200 lines)
- ✅ No external dependencies beyond MongoDB
- ✅ Good learning foundation

**Components to Extract:**
```typescript
// From backend/src/services/departmentService.ts
- GET /api/departments
- POST /api/departments/ensure
- POST /api/departments/{id}/increment
- POST /api/departments/transfer
```

**Data Model:**
```typescript
{
  _id: ObjectId,
  key: string,          // "computer_science"
  name: string,         // "Computer Science"
  user_count: number,
  created: Date,
  updated: Date
}
```

**Estimated Time:** 2-3 hours

---

## 🔜 Phase 3: Chat & WebSocket

### Chat Service

**Complexity:** High
- WebSocket management
- Bull Queue for background jobs
- Redis for session management
- Real-time message streaming

**Endpoints:**
```
POST /api/chat
GET /api/chat/history
DELETE /api/chat/session/{id}
WS /ws (WebSocket endpoint)
```

**Challenges:**
- Sticky sessions for WebSocket
- Queue management
- State synchronization

**Estimated Time:** 1-2 days

---

## 🔜 Phase 4: RAG & Vector Search

### RAG Service

**Complexity:** High
- ChromaDB integration
- Embedding generation
- Vector search
- Document processing

**Endpoints:**
```
POST /api/embedding/generate
POST /api/chroma/query
GET /api/collections
POST /api/training/upload
```

**Components:**
- Embedding service
- ChromaDB service
- Document service
- Collection service

**Estimated Time:** 2-3 days

---

## 🔜 Phase 5: Training & Document Management

### Training Service

**Complexity:** Medium
- Document upload (PDF, DOCX, CSV, TXT)
- Text extraction
- Chunking & embedding
- MinIO integration

**Endpoints:**
```
POST /api/upload
POST /api/training/start
GET /api/training/history
GET /api/training/status/{id}
```

**Estimated Time:** 1 day

---

## 🔜 Phase 6: Agent Orchestration

### Agent Service

**Complexity:** Very High
- LangChain integration
- Tool registry & execution
- Multi-agent orchestration
- LLM factory

**Endpoints:**
```
POST /api/agents/execute
GET /api/agents
POST /api/agents/create
GET /api/tools
```

**Estimated Time:** 2-3 days

---

## 🔜 Phase 7: Admin & Monitoring

### Admin Service

**Complexity:** Low
- Usage statistics
- User management
- System monitoring
- Queue management

**Endpoints:**
```
GET /api/admin/users
GET /api/admin/stats
GET /api/admin/queue
GET /api/monitoring/health
```

**Estimated Time:** 1 day

---

## 🚀 Phase 8: Nginx Migration (FINAL)

### Move Nginx to K8s Ingress

**When:** After 5+ services are deployed

**Options:**

#### Option 1: Nginx Ingress Controller (Recommended)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mfulearnai-ingress
spec:
  rules:
  - host: mfulearnai.mfu.ac.th
    http:
      paths:
      - path: /api/auth
        backend:
          service: auth-service
      - path: /api/departments
        backend:
          service: department-service
      # ... etc
```

**Pros:**
- Simple configuration
- Well-documented
- Battle-tested

**Cons:**
- Less flexibility than service mesh

#### Option 2: Service Mesh (Istio/Linkerd)
**Pros:**
- Advanced traffic management
- mTLS between services
- Circuit breakers
- Observability

**Cons:**
- Complex setup
- Resource overhead

**Recommendation:** Start with Nginx Ingress, migrate to Service Mesh later if needed.

---

## 📈 Migration Timeline

### Week 1 (Current)
- [x] Auth Service deployed ✅
- [ ] Department Service deployed
- [ ] Chat Service planned

### Week 2
- [ ] Chat Service deployed
- [ ] RAG Service deployed
- [ ] Training Service deployed

### Week 3
- [ ] Agent Service deployed
- [ ] Admin Service deployed
- [ ] Monitoring setup

### Week 4+
- [ ] Nginx Ingress deployed
- [ ] Traffic gradually migrated
- [ ] Decommission monolith

---

## 🎯 Success Criteria

### Per Service
- [ ] Deploys without errors
- [ ] All pods healthy
- [ ] Health checks pass
- [ ] No memory leaks
- [ ] API endpoints work
- [ ] Tests pass

### Overall
- [ ] 5+ services deployed
- [ ] All endpoints functional
- [ ] Performance meets SLA
- [ ] Zero downtime during migration
- [ ] Rollback plan tested

---

## 🔄 Rollback Strategy

### Per Service
1. Change Ingress rule back to monolith
2. Scale down microservice to 0
3. Monitor for issues
4. Investigate and fix

### Complete Rollback
1. Switch Ingress to route all to monolith
2. Stop all microservices
3. Revert DNS if needed
4. Rollback database migrations

---

## 📊 Monitoring Plan

### Metrics to Track
- Request rate per service
- Response time (p50, p95, p99)
- Error rate
- CPU & Memory usage
- Pod restart count
- Queue depth (for Chat service)

### Alerts
- Pod crash loops
- High error rate (>5%)
- High latency (>1s p95)
- Memory leaks
- Disk space low

---

## 💡 Best Practices

### Development
- [ ] Write tests first
- [ ] Use TypeScript
- [ ] Follow REST conventions
- [ ] Document all endpoints
- [ ] Add health checks

### Deployment
- [ ] Multi-stage Docker builds
- [ ] Non-root containers
- [ ] Resource limits set
- [ ] Liveness & readiness probes
- [ ] Auto-scaling configured

### Operations
- [ ] Centralized logging
- [ ] Distributed tracing
- [ ] Metrics collection
- [ ] Regular backups
- [ ] Disaster recovery plan

---

## 🚦 Current Status

**Phase:** 2 - Core Services
**Next Action:** Build Department Service
**Blocking Issues:** None
**Est. Completion:** Week 4

---

## 📝 Notes

- Keep backend monolith running until all services migrated
- Test each service independently before routing traffic
- Use canary deployments for risky changes
- Document everything for future developers
- Prioritize reliability over speed

---

**Updated:** 2025-10-07
**Next Review:** After Department Service deployment
