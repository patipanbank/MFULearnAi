# 3. Technology Stack

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
