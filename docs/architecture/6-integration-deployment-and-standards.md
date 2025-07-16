# 6. Integration, Deployment, and Standards

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
