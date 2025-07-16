# MFULearnAi Brownfield Enhancement Architecture

## Introduction

This document outlines the architectural approach for enhancing MFULearnAi with future extensibility, maintainability, and performance improvements. Its primary goal is to serve as the guiding architectural blueprint for AI-driven development of new features while ensuring seamless integration with the existing system.

**Relationship to Existing Architecture:**
This document supplements existing project architecture by defining how new components will integrate with current systems. Where conflicts arise between new and existing patterns, this document provides guidance on maintaining consistency while implementing enhancements.

### Existing Project Analysis

#### Current Project State
- **Primary Purpose:** AI-powered chat, knowledge management, and agent system for MFU
- **Current Tech Stack:**
  - Frontend: React (TypeScript), Zustand, TailwindCSS
  - Backend: NestJS (TypeScript), WebSocket (Socket.IO), Redis, Chroma, Task Queue
  - Database: MongoDB, Redis
  - Infrastructure: Docker, docker-compose, Nginx, Prometheus
- **Architecture Style:** Modular monolith with real-time and REST API, JWT-based Auth
- **Deployment Method:** Docker Compose, Nginx reverse proxy, Prometheus monitoring

#### Available Documentation
- docs/prd.md (Product Requirements)
- ADMIN_SETUP.md
- PRODUCTION_FIXES.md
- Source code structure (analyzed from repository)

#### Identified Constraints
- Must use existing MongoDB and Redis
- Must maintain JWT-based authentication
- Must support real-time chat and agent features
- Should not break current API contracts
- Must be containerized (Docker)

#### Change Log
| Change | Date | Version | Description | Author |
|--------|------|---------|-------------|--------|
| Initial brownfield architecture | {{date}} | 1.0 | First version based on current system analysis | Winston |

## Enhancement Scope and Integration Strategy

**Enhancement Type:** Brownfield (improvement/extension)
**Scope:** Extensible architecture for new AI features, improved maintainability, and scalability
**Integration Impact:** Medium to High (affects multiple modules, but aims for backward compatibility)

### Integration Approach
- **Code Integration Strategy:** New features will be added as new NestJS modules or React components, following existing modular patterns. Use Dependency Injection and clear interface boundaries.
- **Database Integration:** Extend MongoDB schemas as needed, ensure backward compatibility. Use Mongoose migrations for schema changes.
- **API Integration:** New endpoints will follow RESTful conventions and JWT auth. Existing endpoints will not be broken.
- **UI Integration:** New UI features/components will be added in `src/pages/` or `src/shared/ui/` following current design and state management patterns.

### Compatibility Requirements
- **Existing API Compatibility:** All new APIs must be backward compatible
- **Database Schema Compatibility:** Additive changes only, no destructive migrations
- **UI/UX Consistency:** Follow current TailwindCSS and component-based design
- **Performance Impact:** Monitor with Prometheus, optimize for real-time features

## Tech Stack Alignment

| Category      | Current Technology | Version | Usage in Enhancement | Notes |
|--------------|--------------------|---------|----------------------|-------|
| Frontend     | React, Zustand, TailwindCSS | latest | Yes | Follow existing patterns |
| Backend      | NestJS, Socket.IO  | latest  | Yes | Modular, DI, REST & WS |
| Database     | MongoDB, Redis     | latest  | Yes | Extend schemas only |
| Infrastructure | Docker, Nginx, Prometheus | latest | Yes | No change |

## Data Models and Schema Changes
- New data models will be added as Mongoose schemas in new modules
- Existing models will only be extended, not modified destructively
- Migrations will be handled via scripts or Mongoose migration tools

## Component Architecture
- New backend features = new NestJS modules/services/controllers
- New frontend features = new React pages/components/hooks
- Integration via DI, REST API, and WebSocket events

## API Design and Integration
- New endpoints will be versioned if breaking changes are needed
- JWT auth and role-based guards will be used for all protected endpoints
- WebSocket events will follow current event naming conventions

---

> **หมายเหตุ:** หากต้องการรายละเอียดเชิงลึกในแต่ละหัวข้อ หรือมี enhancement เฉพาะเจาะจง กรุณาแจ้ง Winston เพื่อปรับแต่งเอกสารนี้ให้เหมาะสมยิ่งขึ้น 