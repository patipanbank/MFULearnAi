# MFULearnAI - Kubernetes Migration Plan

## 📋 Executive Summary

This document outlines the complete plan for migrating MFULearnAI from Docker Compose to Kubernetes, implementing a modern microservices architecture based on 2025 best practices.

## 🎯 Current State vs Future State

### Current State (Docker Compose)
```
┌─────────────────────────────────────┐
│     Monolithic Backend (Express)    │
│  ┌──────────────────────────────┐   │
│  │ Auth, Chat, Agent, Training  │   │
│  │ RAG, Upload, Admin, etc.     │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
         │  │  │  │
         ▼  ▼  ▼  ▼
   MongoDB Redis ChromaDB MinIO

Issues:
- Tight coupling between modules
- Difficult to scale independently
- Single point of failure
- Limited deployment flexibility
- Hard to implement different update strategies
```

### Future State (Kubernetes + Microservices)
```
                  ┌─────────────┐
                  │  Ingress    │
                  └──────┬──────┘
                         │
                  ┌──────▼──────┐
                  │ API Gateway │
                  └──────┬──────┘
              ┌──────────┼──────────┐
              ▼          ▼          ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐
      │   Auth   │ │   Chat   │ │  Agent   │
      │ Service  │ │ Service  │ │ Service  │
      └────┬─────┘ └────┬─────┘ └────┬─────┘
           │            │            │
           └────────────┼────────────┘
                        ▼
              Infrastructure Layer
         MongoDB  Redis  ChromaDB  MinIO

Benefits:
✓ Independent scaling per service
✓ Isolated failures
✓ Independent deployments
✓ Better resource utilization
✓ Service mesh ready
✓ Cloud-native observability
```

## 📊 Architecture Components

### Infrastructure Components (Created ✅)
Located in: `k8s/infrastructure/`

1. **MongoDB** - StatefulSet
   - Primary database
   - 20Gi persistent storage
   - Health checks configured
   - Backup-ready

2. **Redis** - Deployment
   - Caching and sessions
   - 10Gi persistent storage
   - Pub/sub for real-time features

3. **ChromaDB** - Deployment
   - Vector database
   - 50Gi persistent storage
   - RAG and embeddings

4. **MinIO** - Deployment
   - S3-compatible storage
   - 100Gi persistent storage
   - File uploads and documents

### Microservices (Partially Created ✅)

#### Completed Services:
1. **auth-service** ✅
   - Location: `k8s/services/auth-service/`
   - Features: JWT, Session, SAML auth
   - Replicas: 2-10 (HPA)
   - Port: 3000

2. **department-service** ✅
   - Location: `k8s/services/department-service/`
   - Features: Department CRUD, user relationships
   - Replicas: 2-8 (HPA)
   - Port: 3001

#### Services to Create:
3. **chat-service** ⏳
   - WebSocket connections
   - Message history
   - Port: 3002

4. **agent-service** ⏳
   - AI agent orchestration
   - Multi-agent coordination
   - Port: 3003

5. **rag-service** ⏳
   - Vector embeddings
   - Document retrieval
   - Port: 3004

6. **training-service** ⏳
   - Document processing
   - Queue management
   - Port: 3005

7. **storage-service** ⏳
   - File management
   - MinIO integration
   - Port: 3006

8. **bedrock-gateway** ✅
   - AWS Bedrock proxy
   - Already exists in bedrock-api-gateway/
   - Port: 8000

### Gateway Layer (Created ✅)
Located in: `k8s/gateway/`

1. **API Gateway**
   - Request routing
   - Authentication
   - Rate limiting
   - Replicas: 3-20 (HPA)

2. **Ingress**
   - NGINX Ingress Controller
   - TLS termination
   - Path-based routing

### Monitoring (Created ✅)
Located in: `k8s/monitoring/`

1. **Prometheus**
   - Metrics collection
   - Alert evaluation

2. **Grafana**
   - Dashboards
   - Visualization

3. **Exporters**
   - MongoDB Exporter
   - Redis Exporter

## 🗂️ Directory Structure

```
k8s/
├── README.md                      # Complete documentation
├── DEPLOYMENT.md                  # Step-by-step deployment guide
├── ARCHITECTURE.md                # Architecture deep-dive
├── QUICKSTART.md                  # Quick reference
├── deploy.sh                      # Automated deployment script
├── undeploy.sh                    # Cleanup script
├── kustomization.yaml             # Base Kustomize config
├── .gitignore                     # Protect secrets
│
├── namespaces/
│   └── namespaces.yaml           # 4 namespaces defined
│
├── infrastructure/               # ✅ Complete
│   ├── mongodb/
│   ├── redis/
│   ├── chromadb/
│   └── minio/
│
├── services/                     # ⚠️ Partial
│   ├── auth-service/            # ✅ Complete
│   ├── department-service/      # ✅ Complete
│   ├── chat-service/            # ⏳ To create
│   ├── agent-service/           # ⏳ To create
│   ├── rag-service/             # ⏳ To create
│   ├── training-service/        # ⏳ To create
│   ├── storage-service/         # ⏳ To create
│   └── bedrock-gateway/         # ⏳ To migrate
│
├── gateway/                      # ✅ Complete
│   ├── ingress/
│   └── api-gateway/
│
├── monitoring/                   # ✅ Complete
│   ├── prometheus/
│   ├── grafana/
│   ├── mongodb-exporter.yaml
│   └── redis-exporter.yaml
│
├── overlays/                     # ✅ Complete (Kustomize)
│   ├── development/
│   └── production/
│
├── secrets-template.yaml         # ✅ Complete
└── configmaps.yaml              # ✅ Complete
```

## 🚀 Migration Strategy

### Phase 1: Foundation (Completed ✅)
**Duration**: 2-3 days

Tasks Completed:
- [x] Create Kubernetes manifests for infrastructure
- [x] Setup namespaces (4 namespaces)
- [x] Configure persistent storage
- [x] Setup monitoring stack
- [x] Create deployment scripts
- [x] Document everything

**Deliverables**:
- ✅ Complete infrastructure manifests
- ✅ Monitoring stack configured
- ✅ Documentation (README, DEPLOYMENT, ARCHITECTURE, QUICKSTART)
- ✅ Deployment automation scripts

### Phase 2: Core Services Migration (Next)
**Duration**: 1-2 weeks
**Status**: 25% Complete (2/8 services)

Tasks:
- [x] Create auth-service manifests
- [x] Create department-service manifests
- [ ] Extract chat logic into chat-service
- [ ] Extract agent logic into agent-service
- [ ] Extract RAG logic into rag-service
- [ ] Extract training logic into training-service
- [ ] Extract storage logic into storage-service
- [ ] Migrate bedrock-gateway

**For Each Service**:
1. Create new service directory structure
2. Extract code from monolith
3. Create Dockerfile
4. Create Kubernetes manifests (Deployment, Service, HPA)
5. Create health check endpoints
6. Test locally with Docker
7. Deploy to Kubernetes
8. Update API Gateway routing
9. Test end-to-end

### Phase 3: API Gateway Implementation
**Duration**: 3-5 days

Tasks:
- [ ] Build API Gateway application (Node.js/Express)
- [ ] Implement request routing logic
- [ ] Implement JWT validation middleware
- [ ] Implement rate limiting (Redis-based)
- [ ] Implement WebSocket proxy for chat
- [ ] Add request/response logging
- [ ] Add Prometheus metrics
- [ ] Deploy and test

### Phase 4: Testing & Validation
**Duration**: 1 week

Tasks:
- [ ] Unit testing for each service
- [ ] Integration testing
- [ ] Load testing (K6/Apache Bench)
- [ ] Security testing
- [ ] Monitoring validation
- [ ] Backup/restore testing
- [ ] Disaster recovery testing

### Phase 5: Service Mesh (Optional)
**Duration**: 1 week

Tasks:
- [ ] Install Istio or Linkerd
- [ ] Configure mTLS between services
- [ ] Setup traffic management
- [ ] Configure circuit breakers
- [ ] Setup distributed tracing
- [ ] Migrate monitoring to service mesh

### Phase 6: Production Deployment
**Duration**: 1-2 days

Tasks:
- [ ] Setup production cluster
- [ ] Configure production secrets
- [ ] Setup TLS certificates
- [ ] Configure DNS
- [ ] Deploy to production
- [ ] Smoke testing
- [ ] Cut over traffic
- [ ] Monitor closely

## 📅 Detailed Timeline

### Week 1: Foundation ✅
- **Day 1-2**: Infrastructure manifests
- **Day 3-4**: Monitoring setup
- **Day 5**: Documentation & automation scripts
- **Status**: Completed

### Week 2-3: Service Extraction
- **Day 1-2**: Chat service
- **Day 3-4**: Agent service
- **Day 5-6**: RAG service
- **Day 7-8**: Training service
- **Day 9-10**: Storage service & Bedrock gateway migration

### Week 4: API Gateway
- **Day 1-2**: Gateway application development
- **Day 3-4**: Testing & integration
- **Day 5**: Deployment & validation

### Week 5: Testing
- **Day 1-2**: Functional testing
- **Day 3**: Load testing
- **Day 4**: Security testing
- **Day 5**: Bug fixes

### Week 6: Production
- **Day 1-2**: Production setup
- **Day 3**: Deployment
- **Day 4-5**: Monitoring & optimization

## 📋 Implementation Checklist

### Infrastructure Setup
- [x] Kubernetes cluster provisioned
- [x] kubectl configured
- [x] Storage class configured
- [x] Ingress controller installed
- [x] Metrics server installed

### Code Extraction
For each service:
- [ ] Extract business logic
- [ ] Create service directory
- [ ] Setup package.json
- [ ] Create Dockerfile
- [ ] Add health endpoints (/health, /ready)
- [ ] Add Prometheus metrics endpoint
- [ ] Write unit tests

### Kubernetes Manifests
For each service:
- [x] Deployment.yaml (with replicas, resources, probes)
- [x] Service.yaml (ClusterIP)
- [x] ConfigMap.yaml (if needed)
- [x] Secret.yaml (if needed)
- [x] HPA.yaml (Horizontal Pod Autoscaler)

### API Gateway
- [ ] Gateway application created
- [ ] Routing rules configured
- [ ] Authentication middleware
- [ ] Rate limiting configured
- [ ] WebSocket support
- [ ] Prometheus metrics

### Security
- [ ] Secrets created (not committed to Git)
- [ ] TLS certificates configured
- [ ] Network policies created
- [ ] RBAC configured
- [ ] Pod security standards enforced
- [ ] Image scanning implemented

### Monitoring
- [x] Prometheus deployed
- [x] Grafana deployed
- [x] Exporters configured
- [ ] Dashboards imported
- [ ] Alerts configured
- [ ] Log aggregation setup (optional)

### Testing
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] Load tests executed
- [ ] Security scan completed
- [ ] Backup/restore tested

### Documentation
- [x] README.md
- [x] DEPLOYMENT.md
- [x] ARCHITECTURE.md
- [x] QUICKSTART.md
- [ ] Runbook created
- [ ] Incident response plan

### Deployment
- [ ] Development environment tested
- [ ] Staging environment tested
- [ ] Production cluster ready
- [ ] DNS configured
- [ ] TLS certificates installed
- [ ] Deployed to production
- [ ] Smoke tests passed

## 🎓 Training & Knowledge Transfer

### Team Training Needed
1. **Kubernetes Basics** (2 days)
   - Pods, Deployments, Services
   - ConfigMaps, Secrets
   - Namespaces, Labels, Selectors

2. **kubectl Commands** (1 day)
   - Basic operations
   - Debugging techniques
   - Log analysis

3. **Microservices Patterns** (1 day)
   - Service communication
   - Error handling
   - Distributed tracing

4. **Monitoring & Alerting** (0.5 day)
   - Prometheus queries
   - Grafana dashboards
   - Alert management

### Documentation to Create
- [ ] Service architecture diagrams
- [ ] API documentation for each service
- [ ] Runbook for common operations
- [ ] Incident response procedures
- [ ] Backup and restore procedures

## 💰 Resource Requirements

### Kubernetes Cluster
**Minimum**: 3 nodes, 8 CPU, 32GB RAM per node
**Recommended**: 5 nodes, 16 CPU, 64GB RAM per node

### Storage
- MongoDB: 20Gi (can grow)
- Redis: 10Gi
- ChromaDB: 50Gi (can grow)
- MinIO: 100Gi (can grow)
- Prometheus: 50Gi
- Grafana: 10Gi

**Total**: ~240Gi minimum

### Network
- LoadBalancer for Ingress
- Network policies support
- Inter-node networking

## 🔍 Success Criteria

### Technical Metrics
- [ ] All services deployed and running
- [ ] Zero-downtime deployments achieved
- [ ] Auto-scaling working correctly
- [ ] Response times < 200ms (p95)
- [ ] Error rate < 0.1%
- [ ] Resource utilization optimized

### Operational Metrics
- [ ] Monitoring dashboards operational
- [ ] Alerts configured and tested
- [ ] Backup procedures tested
- [ ] Disaster recovery tested
- [ ] Team trained on operations

### Business Metrics
- [ ] All features working correctly
- [ ] User authentication working
- [ ] Chat functionality working
- [ ] Training pipeline working
- [ ] Admin features working

## 🚨 Risk Assessment

### High Risk
1. **Data Loss During Migration**
   - Mitigation: Multiple backups, test restore procedures

2. **Service Downtime**
   - Mitigation: Parallel running, gradual traffic shift

3. **Performance Degradation**
   - Mitigation: Load testing, performance monitoring

### Medium Risk
1. **Learning Curve**
   - Mitigation: Training, documentation, support

2. **Complexity Increase**
   - Mitigation: Good documentation, automation

3. **Cost Increase**
   - Mitigation: Right-sizing, auto-scaling, monitoring

### Low Risk
1. **Tool Compatibility**
   - Mitigation: Use standard tools, test early

## 📞 Support & Escalation

### Levels of Support
**L1**: Basic troubleshooting (logs, restarts)
**L2**: Service debugging, configuration changes
**L3**: Architecture changes, code fixes

### Contact Information
- Email: mfulearnai-support@mfu.ac.th
- Slack: #mfulearnai-ops
- On-call: [TBD]

## 🎉 Conclusion

The foundation for Kubernetes migration is complete. Next steps:
1. Extract remaining services from monolith
2. Build API Gateway application
3. Complete testing
4. Deploy to production

**Current Progress**: ~35% complete
**Estimated Completion**: 6 weeks from now

---

**Document Version**: 1.0
**Last Updated**: October 7, 2025
**Author**: MFU IT Team with Claude Code
