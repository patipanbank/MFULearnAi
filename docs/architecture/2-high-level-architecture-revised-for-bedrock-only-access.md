# 2. High Level Architecture (Revised for Bedrock-Only Access)

### 2.1 Technical Summary

- **Architecture Style:** Modular monolith (future microservices-ready), event-driven, real-time
- **Frontend:** React 19 + TypeScript + Zustand + Tailwind CSS
- **Backend:** NestJS 10 + TypeScript, REST + WebSocket APIs
- **AI/LLM:** AWS Bedrock (university-provided, API access only), ChromaDB for vector search, agent tool integration
- **Data:** MongoDB (self-hosted or university-managed), Redis (self-hosted or university-managed), MinIO (self-hosted S3-compatible) for file storage
- **Deployment:** On-premises or university-managed VMs/servers, Docker Compose for orchestration, Nginx API gateway
- **Security:** SAML SSO, JWT, role/department-based access

### 2.2 Platform & Infrastructure

- **Platform:** University-managed infrastructure (on-premises servers, VMs, or private cloud)
- **Key Services:**
  - **Compute:** University VMs/servers (Dockerized)
  - **Database:** MongoDB (self-hosted)
  - **Cache:** Redis (self-hosted)
  - **File Storage:** MinIO (self-hosted S3-compatible)
  - **AI/LLM:** AWS Bedrock (university account, API access only)
  - **Monitoring:** Prometheus + Grafana (self-hosted)
- **Deployment Regions:** University data center or private cloud

**Rationale:**
Since the university can only access AWS Bedrock, all other infrastructure must be self-hosted or run on university-managed resources. The only external dependency is the Bedrock API, which is accessed securely from the backend.

### 2.3 Repository Structure

```
mfulearnai/
├── backend/           # NestJS backend
├── frontend/          # React frontend
├── shared/            # Shared types/utilities
├── docs/              # Documentation
├── infrastructure/    # Docker Compose, Nginx, monitoring configs
└── scripts/           # Build/deploy scripts
```

### 2.4 Architecture Diagram (Updated)

```mermaid
graph TB
    subgraph "Client Layer"
        Web[Web Browser]
        Mobile[Mobile App]
    end
    subgraph "Frontend Layer"
        React[React App]
        CDN[CDN/Static Assets]
    end
    subgraph "API Gateway"
        Nginx[Nginx Reverse Proxy]
    end
    subgraph "Backend Services"
        Auth[Auth Service]
        Chat[Chat Service]
        Agent[Agent Service]
        Collection[Collection Service]
        Upload[Upload Service]
        Training[Training Service]
        WebSocket[WebSocket Gateway]
    end
    subgraph "Data Layer"
        MongoDB[(MongoDB)]
        ChromaDB[(ChromaDB)]
        Redis[(Redis)]
        MinIO[(MinIO/S3)]
    end
    subgraph "External AI Service"
        Bedrock[AWS Bedrock (API Only)]
    end
    Web --> Nginx
    Mobile --> Nginx
    Nginx --> React
    Nginx --> Auth
    Nginx --> Chat
    Nginx --> Agent
    Nginx --> Collection
    Nginx --> Upload
    Nginx --> Training
    Nginx --> WebSocket
    Auth --> MongoDB
    Chat --> MongoDB
    Agent --> MongoDB
    Collection --> MongoDB
    Training --> MongoDB
    Collection --> ChromaDB
    Upload --> MinIO
    Chat --> Bedrock
    Agent --> Bedrock
    WebSocket --> Redis
```

### 2.5 Architectural Patterns (Unchanged)

- **Modular Monolith (microservices-ready)**
- **API Gateway (Nginx)**
- **Event-Driven (Redis PubSub)**
- **Repository Pattern (data access)**
- **CQRS (read/write separation for chat, analytics)**
- **WebSocket Gateway (real-time chat/agent)**
- **Component-based UI (React + Zustand)**
- **SAML SSO + JWT (auth)**
- **IaC (Docker Compose)**
- **Centralized Logging/Monitoring (Winston, Prometheus, Grafana)**

---
