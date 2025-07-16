# MFULearnAi Brownfield Enhancement PRD

## 1. Intro Project Analysis and Context

### Existing Project Overview
- **Analysis Source:** IDE-based fresh analysis
- **Current Project State:**
  - Modular monolith, event-driven, real-time architecture
  - Frontend: React 19 + TypeScript + Zustand + Tailwind CSS
  - Backend: NestJS 10 + TypeScript, REST + WebSocket APIs
  - AI/LLM: AWS Bedrock, ChromaDB for vector search, agent tool integration
  - Data: MongoDB, Redis, MinIO (S3-compatible)
  - Deployment: Docker Compose, Nginx API gateway, on-premises or university-managed VMs/servers
  - Security: SAML SSO, JWT, role/department-based access

### Available Documentation Analysis
- Using existing project analysis from architecture.md
- Key documents: architecture.md

### Enhancement Scope Definition
- **Enhancement Type:** Major Feature Modification, Performance/Scalability Improvements, Technology Stack Upgrade
- **Enhancement Description:**
  - Modernize and optimize the system by upgrading the tech stack, refactoring major features, and improving performance/scalability, while keeping the auth system unchanged.
- **Impact Assessment:** Significant Impact (substantial existing code changes)

### Goals and Background Context
- **Goals:**
  - Deliver a scalable, maintainable, and secure platform for Mae Fah Luang University
  - Support SAML SSO, real-time chat, agent management, and knowledge base
  - Enable efficient handling of increased user load
- **Background Context:**
  - The system is being migrated from FastAPI to a modern, modular NestJS backend and React frontend. The authentication system will remain unchanged to preserve existing integrations and security protocols.

### Change Log
| Change | Date | Version | Description | Author |
|--------|------|---------|-------------|--------|
| Initial PRD draft | {{date}} | 0.1 | Created initial PRD from template | John (PM) |

---

## 2. Requirements

### Functional Requirements (FR)
1. FR1: The system must be rebuilt using the latest versions of React, NestJS, and TypeScript, maintaining all current core features except authentication.
2. FR2: The new architecture must support real-time chat, agent management, knowledge base, and document upload functionalities.
3. FR3: The system must integrate with AWS Bedrock for AI/LLM features and ChromaDB for vector search.
4. FR4: The backend must expose REST and WebSocket APIs for all major modules.
5. FR5: The system must support SAML SSO and JWT for authentication, preserving the existing auth system and its integrations.
6. FR6: The deployment must use Docker Compose and support on-premises or university-managed infrastructure.

### Non-Functional Requirements (NFR)
1. NFR1: The system must be scalable to support increased user load without significant performance degradation.
2. NFR2: The codebase must be modular, maintainable, and follow modern best practices for both frontend and backend.
3. NFR3: The system must maintain or improve current security standards, especially for user data and authentication.
4. NFR4: The system must be compatible with university-managed infrastructure and self-hosted services.
5. NFR5: The system must include comprehensive logging, monitoring, and automated testing (unit, integration, E2E).

### Compatibility Requirements (CR)
1. CR1: Existing API compatibility must be maintained for the authentication system.
2. CR2: Database schema changes must not break existing user or authentication data.
3. CR3: UI/UX consistency must be preserved where possible, with improvements documented.
4. CR4: Integration compatibility with AWS Bedrock, ChromaDB, and university-managed services must be ensured.

---

## 3. Epic and Story Structure
*To be completed: Will be structured based on validated requirements and project analysis.*

## 4. Technical Constraints and Integration Requirements
*To be completed: Will detail tech stack, integration, code organization, deployment, and risk assessment.* 