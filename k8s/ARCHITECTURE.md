# MFULearnAI Kubernetes Architecture

## 🎯 Architecture Overview

MFULearnAI is designed as a cloud-native microservices architecture running on Kubernetes, following best practices from 2025 industry standards.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Internet / Users                          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   NGINX Ingress Controller   │
        │   - TLS Termination          │
        │   - Rate Limiting            │
        │   - Path Routing             │
        └──────────────┬───────────────┘
                       │
                       ▼
        ┌──────────────────────────────┐
        │   mfulearnai-gateway         │
        │   ┌────────────────────┐     │
        │   │   API Gateway      │     │
        │   │  - Authentication  │     │
        │   │  - Rate Limiting   │     │
        │   │  - Request Routing │     │
        │   └──────────┬─────────┘     │
        └──────────────┼───────────────┘
                       │
        ┌──────────────┴───────────────┐
        │                              │
        ▼                              ▼
┌───────────────┐           ┌────────────────────┐
│ mfulearnai-   │           │ mfulearnai-core    │
│ services      │           │                    │
│               │           │ ┌────────────┐     │
│ ┌──────────┐  │◄─────────►│ │  MongoDB   │     │
│ │Auth Svc  │  │           │ └────────────┘     │
│ └──────────┘  │           │                    │
│               │           │ ┌────────────┐     │
│ ┌──────────┐  │◄─────────►│ │   Redis    │     │
│ │Dept Svc  │  │           │ └────────────┘     │
│ └──────────┘  │           │                    │
│               │           │ ┌────────────┐     │
│ ┌──────────┐  │◄─────────►│ │ ChromaDB   │     │
│ │Chat Svc  │  │           │ └────────────┘     │
│ └──────────┘  │           │                    │
│               │           │ ┌────────────┐     │
│ ┌──────────┐  │◄─────────►│ │   MinIO    │     │
│ │Agent Svc │  │           │ └────────────┘     │
│ └──────────┘  │           │                    │
│               │           └────────────────────┘
│ ┌──────────┐  │
│ │RAG Svc   │  │
│ └──────────┘  │                    ┌────────────────────┐
│               │                    │ mfulearnai-        │
│ ┌──────────┐  │                    │ monitoring         │
│ │Training  │  │◄───────────────────┤                    │
│ │Svc       │  │    Scrape          │ ┌────────────┐     │
│ └──────────┘  │    Metrics         │ │ Prometheus │     │
│               │                    │ └────────────┘     │
│ ┌──────────┐  │                    │                    │
│ │Storage   │  │                    │ ┌────────────┐     │
│ │Svc       │  │                    │ │  Grafana   │     │
│ └──────────┘  │                    │ └────────────┘     │
│               │                    │                    │
│ ┌──────────┐  │                    └────────────────────┘
│ │Bedrock   │  │
│ │Gateway   │  │───────────► AWS Bedrock API
│ └──────────┘  │
└───────────────┘
```

## 🏗️ Design Principles

### 1. Separation of Concerns
- **Namespaces**: Logical isolation of services by function
- **Microservices**: Each service has a single, well-defined responsibility
- **Layered Architecture**: Gateway → Services → Infrastructure

### 2. Scalability
- **Horizontal Pod Autoscaling (HPA)**: Automatic scaling based on CPU/Memory
- **Stateless Services**: All application services are stateless
- **Persistent Storage**: Stateful components use PersistentVolumes

### 3. Resilience
- **Multi-Replica Deployments**: All services run with 2+ replicas
- **Health Checks**: Liveness, Readiness, and Startup probes
- **Rolling Updates**: Zero-downtime deployments
- **Circuit Breakers**: Service mesh ready for advanced patterns

### 4. Security
- **RBAC**: Role-based access control for all services
- **Network Policies**: Restricted pod-to-pod communication
- **Secrets Management**: Encrypted secret storage
- **Pod Security Standards**: Restricted execution policies
- **TLS Everywhere**: Encrypted external and internal traffic

### 5. Observability
- **Metrics**: Prometheus for metrics collection
- **Visualization**: Grafana dashboards
- **Logging**: Structured JSON logs with correlation IDs
- **Tracing**: Service mesh ready for distributed tracing

## 📦 Component Details

### Namespaces

#### mfulearnai-core
**Purpose**: Infrastructure components that other services depend on

**Components**:
- MongoDB (StatefulSet) - Primary database
- Redis (Deployment) - Caching and session storage
- ChromaDB (Deployment) - Vector database for embeddings
- MinIO (Deployment) - S3-compatible object storage
- MongoDB Exporter - Metrics exporter
- Redis Exporter - Metrics exporter

**Network**: Accessible only from `mfulearnai-services` namespace

#### mfulearnai-services
**Purpose**: Business logic microservices

**Components**:
1. **auth-service** (Port 3000)
   - User authentication (JWT, Session, SAML)
   - Authorization and RBAC
   - User management

2. **department-service** (Port 3001)
   - Department CRUD operations
   - User-department relationships
   - Department statistics

3. **chat-service** (Port 3002)
   - Chat session management
   - Message history
   - WebSocket connections

4. **agent-service** (Port 3003)
   - AI Agent orchestration
   - Agent lifecycle management
   - Multi-agent coordination

5. **rag-service** (Port 3004)
   - Vector embeddings
   - Semantic search
   - Document retrieval

6. **training-service** (Port 3005)
   - Document processing
   - Training job management
   - Queue management (Bull/Celery)

7. **storage-service** (Port 3006)
   - File upload/download
   - MinIO integration
   - File metadata management

8. **bedrock-gateway** (Port 8000)
   - AWS Bedrock API proxy
   - Rate limiting
   - Usage tracking

**Network**:
- Accessible from `mfulearnai-gateway`
- Can access `mfulearnai-core`

#### mfulearnai-gateway
**Purpose**: External access and API aggregation

**Components**:
1. **API Gateway** (Port 8080)
   - Request routing to microservices
   - Authentication middleware
   - Rate limiting
   - Request/response transformation
   - WebSocket proxy

2. **Ingress Controller** (NGINX)
   - TLS termination
   - Path-based routing
   - External load balancing
   - CORS handling

**Network**:
- Accessible from Internet
- Can access all services in `mfulearnai-services`

#### mfulearnai-monitoring
**Purpose**: Observability and monitoring

**Components**:
1. **Prometheus**
   - Metrics collection
   - Alert evaluation
   - Time-series database

2. **Grafana**
   - Visualization dashboards
   - Alert notifications
   - User management

**Network**:
- Accessible via internal ingress
- Can scrape metrics from all namespaces

## 🔄 Request Flow

### User Request Flow
```
1. User → HTTPS Request
2. NGINX Ingress → TLS Termination
3. Ingress → Routes to API Gateway
4. API Gateway → Validates JWT/Session
5. API Gateway → Routes to appropriate microservice
6. Microservice → Processes request
7. Microservice → May call other microservices
8. Microservice → Accesses infrastructure (DB, Cache)
9. Microservice → Returns response
10. API Gateway → Aggregates/transforms response
11. NGINX Ingress → Returns to user
```

### Chat Request Flow (WebSocket)
```
1. User → WSS Connection
2. NGINX Ingress → Upgrade to WebSocket
3. API Gateway → WebSocket Proxy
4. Chat Service → Maintains WS connection
5. Chat Service → Calls Agent Service
6. Agent Service → Calls RAG Service
7. RAG Service → Queries ChromaDB
8. Agent Service → Calls Bedrock Gateway
9. Bedrock Gateway → AWS Bedrock API
10. Response streams back through chain
11. Chat Service → Sends to user via WebSocket
```

### Training Job Flow
```
1. User → Uploads document via API
2. Storage Service → Saves to MinIO
3. Training Service → Enqueues job in Redis
4. Worker Pod → Picks up job
5. Worker → Processes document (PDF, DOCX, etc.)
6. Worker → Generates embeddings via RAG Service
7. RAG Service → Stores in ChromaDB
8. Training Service → Updates job status
9. User → Receives completion notification
```

## 📊 Data Flow

### Data Storage Strategy

#### Hot Data (Redis)
- User sessions
- JWT blacklist
- Rate limiting counters
- Queue jobs (Bull)
- Real-time chat state

**TTL**: Short (minutes to hours)

#### Warm Data (MongoDB)
- User accounts
- Chat histories
- Training job metadata
- Agent configurations
- Department records

**Retention**: Long-term (years)

#### Cold Data (MinIO)
- Uploaded documents
- Generated reports
- Backup files
- Training datasets

**Retention**: Indefinite (with lifecycle policies)

#### Vector Data (ChromaDB)
- Document embeddings
- Semantic search indexes
- RAG context

**Retention**: Until document deleted

## 🔒 Security Architecture

### Defense in Depth

#### Layer 1: Network Perimeter
- **Ingress Controller**: First line of defense
- **TLS Termination**: All external traffic encrypted
- **Rate Limiting**: DDoS protection
- **WAF** (optional): Web Application Firewall

#### Layer 2: API Gateway
- **Authentication**: JWT validation
- **Authorization**: Role-based access
- **Request Validation**: Schema validation
- **Rate Limiting**: Per-user limits

#### Layer 3: Service Mesh (Future)
- **mTLS**: Service-to-service encryption
- **Identity**: Service identity verification
- **Policy Enforcement**: Fine-grained access control

#### Layer 4: Application
- **Input Validation**: All inputs sanitized
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Output encoding
- **CSRF Protection**: Token validation

#### Layer 5: Data
- **Encryption at Rest**: Volume encryption
- **Encryption in Transit**: TLS everywhere
- **Secret Management**: Kubernetes Secrets
- **Access Auditing**: All access logged

### Network Policies

```
┌─────────────────────┐
│ Internet            │
└──────┬──────────────┘
       │ HTTPS only
       ▼
┌─────────────────────┐
│ Ingress             │
└──────┬──────────────┘
       │ Port 8080
       ▼
┌─────────────────────┐
│ API Gateway         │
└──────┬──────────────┘
       │ Service ports only
       ▼
┌─────────────────────┐
│ Microservices       │
└──────┬──────────────┘
       │ Database ports only
       ▼
┌─────────────────────┐
│ Infrastructure      │
└─────────────────────┘
```

**Rules**:
- No direct access to infrastructure from gateway
- No direct access to infrastructure from internet
- Services can only access infrastructure they need
- Monitoring can scrape all namespaces (read-only)

## ⚡ Scaling Strategy

### Horizontal Scaling

#### Application Services
- **Trigger**: CPU > 70% or Memory > 80%
- **Min Replicas**: 2
- **Max Replicas**: 10-20
- **Scale Up**: When metrics sustained for 30s
- **Scale Down**: When metrics below threshold for 5min

#### API Gateway
- **Trigger**: CPU > 70%
- **Min Replicas**: 3
- **Max Replicas**: 20
- **Priority**: High (scales faster)

#### Infrastructure
- **MongoDB**: Vertical scaling or ReplicaSet
- **Redis**: Vertical scaling or Redis Cluster
- **ChromaDB**: Vertical scaling (stateful)
- **MinIO**: Can scale to distributed mode

### Vertical Scaling

When horizontal scaling isn't enough:

1. **Increase Resource Limits**
```yaml
resources:
  requests:
    memory: "1Gi"
    cpu: "1000m"
  limits:
    memory: "2Gi"
    cpu: "2000m"
```

2. **Use Larger Node Types**
- Migrate pods to nodes with more resources
- Add node pools with specific instance types

### Cluster Autoscaling

Enable Cluster Autoscaler to add/remove nodes:
- Add nodes when pods are pending
- Remove nodes when utilization < 50%
- Respect PodDisruptionBudgets

## 🔄 Deployment Strategies

### Rolling Update (Default)
- Deploy new version alongside old
- Gradually shift traffic
- Monitor health checks
- **Rollback**: Automatic if health checks fail

### Blue-Green (Manual)
- Deploy full new environment
- Switch traffic via Service selector
- Keep old environment for quick rollback
- **Use Case**: Major version changes

### Canary (Future with Service Mesh)
- Deploy canary with 5-10% traffic
- Monitor metrics and errors
- Gradually increase traffic
- **Use Case**: High-risk changes

## 📈 Performance Optimization

### Caching Strategy

#### L1 Cache (In-Memory)
- Node.js process memory
- LRU cache for frequently accessed data
- **TTL**: Seconds to minutes

#### L2 Cache (Redis)
- Shared cache across replicas
- Session data, API responses
- **TTL**: Minutes to hours

#### L3 Cache (CDN) - Future
- Static assets
- API responses (with cache headers)
- **TTL**: Hours to days

### Database Optimization

#### Connection Pooling
```javascript
// MongoDB connection pool
mongoose.connect(uri, {
  maxPoolSize: 10,
  minPoolSize: 2,
  socketTimeoutMS: 45000,
})
```

#### Query Optimization
- Indexes on frequently queried fields
- Aggregation pipelines for complex queries
- Projection to limit returned fields

#### Read Replicas (Future)
- Direct read traffic to replicas
- Write to primary only
- Eventual consistency acceptable

## 🔍 Observability

### Three Pillars

#### Metrics (Prometheus)
- **Resource Metrics**: CPU, Memory, Disk, Network
- **Application Metrics**: Request rate, latency, errors
- **Business Metrics**: Users, chats, embeddings

#### Logs (Future: EFK/ELK)
- **Structured Logging**: JSON format
- **Correlation IDs**: Trace requests across services
- **Log Levels**: ERROR, WARN, INFO, DEBUG

#### Traces (Future: Jaeger/Zipkin)
- **Distributed Tracing**: Follow requests across services
- **Span Analysis**: Identify slow operations
- **Dependency Mapping**: Visualize service dependencies

### Golden Signals

Monitor these four key metrics:
1. **Latency**: How long requests take
2. **Traffic**: Request volume
3. **Errors**: Error rate
4. **Saturation**: Resource utilization

## 🚀 Future Enhancements

### Phase 2
- [ ] Service Mesh (Istio/Linkerd)
- [ ] Centralized logging (EFK/ELK)
- [ ] Distributed tracing (Jaeger)
- [ ] GitOps (ArgoCD)
- [ ] Secrets management (Vault/Sealed Secrets)

### Phase 3
- [ ] Multi-cluster deployment
- [ ] Edge computing integration
- [ ] AI model serving (KServe)
- [ ] Serverless functions (Knative)
- [ ] Advanced canary deployments

### Phase 4
- [ ] Multi-region replication
- [ ] Disaster recovery automation
- [ ] Cost optimization with spot instances
- [ ] Advanced AI/ML pipelines
- [ ] Real-time analytics

## 📚 References

- **Kubernetes Best Practices**: [kubernetes.io/docs](https://kubernetes.io/docs/concepts/)
- **12-Factor App**: [12factor.net](https://12factor.net/)
- **Microservices Patterns**: [microservices.io](https://microservices.io/patterns/)
- **Cloud Native Trail Map**: [CNCF](https://github.com/cncf/trailmap)
