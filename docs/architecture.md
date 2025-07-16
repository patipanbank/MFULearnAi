# MFULearnAi Fullstack Architecture Document

---

## 1. Introduction

This document outlines the complete fullstack architecture for **MFULearnAi**, a greenfield rebuild of the university AI assistant platform. The system is being migrated from FastAPI to a modern, modular NestJS backend and React frontend, leveraging TypeScript, Docker, and advanced AI/LLM integrations. The goal is to deliver a scalable, maintainable, and secure platform for Mae Fah Luang University, supporting SAML SSO, real-time chat, agent management, knowledge base, and more.

- **Project Type:** Greenfield rebuild (FastAPI → NestJS/React)
- **Starter Template:** N/A (custom monorepo, leveraging existing SAML SSO)
- **Key Goals:** Scalability, maintainability, real-time AI, university-grade security

---

## 2. High Level Architecture (Revised for Bedrock-Only Access)

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

## 3. Technology Stack

| Category              | Technology         | Version     | Purpose                        | Rationale                                                                 |
|-----------------------|-------------------|-------------|--------------------------------|---------------------------------------------------------------------------|
| **Frontend Language** | TypeScript        | 5.3.x       | Type-safe frontend code        | Modern, safe, and widely supported                                        |
| **Frontend Framework**| React             | 19.x        | UI framework                   | Component-based, fast, large ecosystem                                    |
| **UI Component Lib**  | Tailwind CSS      | 4.x         | Styling                        | Utility-first, rapid prototyping, responsive                              |
| **State Management**  | Zustand           | 5.x         | App state                      | Simple, scalable, avoids Redux boilerplate                                |
| **Backend Language**  | TypeScript        | 5.3.x       | Type-safe backend code         | Consistency with frontend, modern features                                |
| **Backend Framework** | NestJS            | 10.x        | API, WebSocket, modularization | Scalable, DI, microservices-ready                                         |
| **API Style**         | REST + WebSocket  | N/A         | Client-server communication    | REST for CRUD, WebSocket for real-time                                    |
| **Database**          | MongoDB           | 8.x         | Persistent data storage        | Flexible schema, good for chat/AI data                                    |
| **Cache**             | Redis             | 7.x         | Caching, PubSub, sessions      | Fast, supports PubSub for real-time                                       |
| **File Storage**      | MinIO/S3          | latest      | File/document storage          | S3-compatible, on-prem or cloud                                           |
| **Authentication**    | SAML SSO + JWT    | N/A         | User auth/session              | University SSO, JWT for API/session                                       |
| **Frontend Testing**  | Jest + React Testing Library | latest | Unit/integration tests         | Industry standard, good DX                                                |
| **Backend Testing**   | Jest + Supertest  | latest      | Unit/integration tests         | Works natively with NestJS                                                |
| **E2E Testing**       | Playwright        | latest      | End-to-end tests               | Fast, reliable, modern browser support                                    |
| **Build Tool**        | Vite (frontend), Nest CLI (backend) | latest | Build process                 | Fast, modern, supports monorepo                                           |
| **Bundler**           | Vite (frontend), Webpack (backend optional) | latest | Bundling                      | Vite for speed, Webpack if needed for backend assets                      |
| **IaC Tool**          | Docker Compose, Terraform | latest | Infrastructure as code         | Local/dev with Compose, cloud with Terraform                              |
| **CI/CD**             | GitHub Actions    | latest      | Automation                     | Integrates with GitHub, supports Docker, Node, etc.                       |
| **Monitoring**        | Prometheus + Grafana | latest   | Metrics/monitoring             | Open-source, flexible, integrates with NestJS and Docker                  |
| **Logging**           | Winston (backend), Browser Console (frontend) | latest | Centralized logging           | Structured logs, easy integration                                         |
| **CSS Framework**     | Tailwind CSS      | 4.x         | Styling                        | Consistent, utility-first, responsive                                     |

---

## 4. Data Models

### 4.1 User
- `id: string`
- `username: string`
- `email: string`
- `firstName: string`
- `lastName: string`
- `role: 'SuperAdmin' | 'Admin' | 'Staffs' | 'Students'`
- `department?: string`
- `groups?: string[]`
- `created: Date`
- `updated: Date`

### 4.2 Chat
- `id: string`
- `userId: string`
- `agentId?: string`
- `title: string`
- `messages: ChatMessage[]`
- `created: Date`
- `updated: Date`
- `isActive: boolean`
- `isPinned: boolean`
- `metadata?: any`

### 4.3 ChatMessage
- `id: string`
- `role: 'user' | 'assistant' | 'system'`
- `content: string`
- `timestamp: Date`
- `isStreaming?: boolean`
- `isComplete?: boolean`
- `images?: { url: string; mediaType: string }[]`
- `toolUsage?: ToolUsage[]`
- `metadata?: any`

### 4.4 Agent
- `id: string`
- `name: string`
- `description?: string`
- `systemPrompt?: string`
- `modelId: string`
- `collectionNames?: string[]`
- `tools?: AgentTool[]`
- `temperature?: number`
- `maxTokens?: number`
- `isPublic: boolean`
- `createdBy: string`
- `usageCount: number`
- `tags?: string[]`
- `created: Date`
- `updated: Date`

### 4.5 Collection
- `id: string`
- `name: string`
- `permission: 'PRIVATE' | 'DEPARTMENT' | 'PUBLIC'`
- `createdBy: string`
- `modelId?: string`
- `createdAt: Date`
- `documents?: Document[]`

### 4.6 Document
- `id: string`
- `collectionId: string`
- `fileUrl: string`
- `mediaType: string`
- `metadata?: any`
- `createdAt: Date`

### 4.7 ToolUsage
- `type: 'tool_start' | 'tool_result' | 'tool_error'`
- `tool_name: string`
- `tool_input?: string`
- `output?: string`
- `error?: string`
- `timestamp: Date`

### 4.8 TrainingHistory
- `id: string`
- `userId: string`
- `agentId: string`
- `status: 'pending' | 'running' | 'completed' | 'failed'`
- `metrics?: any`
- `createdAt: Date`
- `updatedAt: Date`

---

## 5. Service/Component Design & API Specification

### 5.1 Backend Services & Endpoints

- **AuthService & AuthController**
  - `/auth/login`, `/auth/saml/callback`, `/auth/me`, `/auth/logout`, `/auth/refresh`
- **UserService & UserController**
  - `/users`, `/users/:id`, `/users/me`, `/users/:id/roles`
- **ChatService & ChatController**
  - `/chat`, `/chat/:chatId`, `/chat/history`, `/chat/:chatId/messages`
  - WebSocket: `/ws` (join_room, create_room, send_message, leave_room)
- **AgentService & AgentController**
  - `/agents`, `/agents/:id`, `/agents/templates`, `/agents/:id/use`
- **CollectionService & CollectionController**
  - `/collections`, `/collections/:id`, `/collections/:id/documents`, `/collections/public`
- **DocumentService & UploadController**
  - `/upload`, `/documents/:id`, `/collections/:id/documents`
- **TrainingService & TrainingController**
  - `/training`, `/training/:id`, `/training/history`
- **StatsService & StatsController**
  - `/stats`, `/stats/usage`, `/stats/health`

### 5.2 Frontend Components

- **Auth:** Login, SSO callback, user profile modal
- **Chat:** Chat page, chat history, message input, streaming display
- **Agent:** Agent management, agent selector, agent creation modal
- **Knowledge Base:** Collection list, detail, document upload
- **Admin:** User management, role/department assignment
- **Settings:** Preferences modal, theme switcher
- **Notifications:** Toasts, real-time alerts

### 5.3 API Specification (REST + WebSocket)

- **Auth:**
  - `POST /auth/login`, `GET /auth/saml/login`, `POST/GET /auth/saml/callback`, `GET /auth/me`, `POST /auth/refresh`, `GET /auth/logout`
- **User:**
  - `GET /users`, `GET /users/me`, `PUT /users/me`, `PUT /users/:id/roles`
- **Chat:**
  - `GET /chat/history`, `GET /chat/:chatId`, `POST /chat`, `POST /chat/:chatId/message`, `DELETE /chat/:chatId`
  - **WebSocket `/ws`:** `join_room`, `create_room`, `send_message`, `leave_room`
- **Agent:**
  - `GET /agents`, `GET /agents/:id`, `POST /agents`, `PUT /agents/:id`, `DELETE /agents/:id`, `POST /agents/:id/use`
- **Collection:**
  - `GET /collections`, `GET /collections/:id`, `POST /collections`, `PUT /collections/:id`, `DELETE /collections/:id`, `GET /collections/public`
- **Document/Upload:**
  - `POST /upload`, `GET /documents/:id`, `DELETE /documents/:id`
- **Training:**
  - `GET /training`, `POST /training`, `GET /training/:id`
- **Stats:**
  - `GET /stats`, `GET /stats/usage`

---

## 6. Integration, Deployment, and Standards

### 6.1 Integration
- **API Gateway:** Nginx for SSL, routing, rate limiting
- **WebSocket:** Centralized gateway, Redis PubSub for scaling
- **Frontend/Backend:** Shared TypeScript types, OpenAPI for docs
- **ChromaDB:** For vector search, AI context
- **MinIO/S3:** For file/document storage

### 6.2 Deployment
- **Local:** Docker Compose for all services
- **Cloud:** AWS ECS/EKS, MongoDB Atlas, S3, ElastiCache, Bedrock
- **CI/CD:** GitHub Actions for build, test, deploy
- **IaC:** Terraform for cloud resources

### 6.3 Coding Standards
- **TypeScript everywhere (strict mode)**
- **ESLint + Prettier for linting/formatting**
- **Conventional Commits for git**
- **Feature-based folder structure**
- **Centralized error handling (NestJS filters, React boundaries)**

### 6.4 Testing
- **Unit tests:** Jest (backend/frontend)
- **Integration tests:** Supertest (backend), React Testing Library (frontend)
- **E2E tests:** Playwright
- **Coverage target:** 80%+

### 6.5 Security
- **SAML SSO + JWT**
- **Role/department-based access control**
- **Rate limiting (Nginx, Redis)**
- **Input validation (DTOs, Zod, class-validator)**
- **Centralized logging (Winston, Prometheus)**
- **Regular dependency audits**

---

## 7. Next Steps

1. **Set up monorepo structure and CI/CD pipeline**
2. **Implement core authentication (SAML SSO + JWT)**
3. **Rebuild chat and agent modules (backend + frontend)**
4. **Integrate ChromaDB and Bedrock for AI features**
5. **Rebuild knowledge base and file upload modules**
6. **Implement real-time WebSocket gateway**
7. **Develop admin and analytics features**
8. **Write comprehensive tests and docs**
9. **Deploy to staging, then production**
10. **Monitor, iterate, and improve**

---

**This document is your blueprint for a robust, scalable, and modern MFULearnAi platform.** 