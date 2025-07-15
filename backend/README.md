# Backend Migration: FastAPI to NestJS

This document outlines the comparison between the original Python FastAPI backend and the new Node.js NestJS backend to ensure 100% feature parity before the final migration.

## Migration Checklist & Status

The following table summarizes the status of each module's migration.

| Module | FastAPI (Python) | NestJS (Node.js) | Status | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Authentication** | `routes/auth.py` | `src/auth/` | 🟡 In Progress | |
| **Admin** | `routes/admin.py` | `src/admin/` | ⚪️ Pending | |
| **Agents** | `routes/agents.py` | `src/agent/` | ⚪️ Pending | |
| **Bedrock** | `routes/bedrock.py` | `src/bedrock/` | ⚪️ Pending | |
| **Chat** | `routes/chat.py` | `src/chat/` | ⚪️ Pending | |
| **Collection** | `routes/collection.py` | `src/collection/` | ⚪️ Pending | |
| **Department** | `routes/department.py` | `src/department/` | ⚪️ Pending | |
| **Embedding** | `routes/embedding.py`| `src/embedding/` | ⚪️ Pending | |
| **Stats** | `routes/stats.py` | `src/stats/` | ⚪️ Pending | |
| **Training** | `routes/training.py` | `src/training/` | ⚪️ Pending | |
| **Upload** | `routes/upload.py` | `src/upload/` | ⚪️ Pending | |

---

## Module-by-Module Comparison

### 1. Authentication (`auth`)

**Status:** 🟡 In Progress

**Files Compared:**
- `backend/routes/auth.py`
- `backend-node/src/auth/auth.controller.ts`

#### Endpoint-to-Endpoint Comparison

| Feature | FastAPI Endpoint | NestJS Endpoint | Status & Analysis |
| :--- | :--- | :--- | :--- |
| **SAML Login** | `GET /login/saml` | `GET /login/saml` | ✅ **Matched.** Both redirect to the IdP to initiate login. |
| **SAML Callback** | `GET/POST /saml/callback` | `GET/POST /saml/callback` | ❌ **Critical Gap.** The NestJS implementation validates the SAML response but **does not create a user session or generate a JWT token**. The FastAPI backend correctly finds/creates a user, generates a JWT, and redirects to the frontend with the token. The NestJS `saml/callback` must be updated to include this core logic from `AuthService`. |
| **Simple Logout** | `GET /logout` | `GET /logout` | ✅ **Matched.** Both perform a simple redirect to the frontend logout page. |
| **SAML Logout** | `GET /logout/saml` | `GET /logout/saml` | ✅ **Matched.** Both initiate the SAML Single Logout (SLO) process. |
| **SAML Logout Callback**| `GET/POST /logout/saml/callback`|`GET/POST /logout/saml/callback`| ✅ **Matched.** Both handle the logout response from the IdP. |
| **Manual SAML Logout**| `GET /logout/saml/manual`| `GET /logout/saml/manual`| ✅ **Matched.** |
| **SAML Metadata** | `GET /metadata` | `GET /metadata` | ✅ **Matched.** Both expose the SP metadata XML. |
| **Admin Login** | `POST /admin/login` | `POST /admin/login` | ✅ **Matched.** Both handle username/password login for admin roles. |
| **Get User Profile** | `GET /me` | `GET /profile` | ⚠️ **Needs Improvement.** The functionality is the same, but the endpoint path should be changed from `/profile` to `/me` for 100% parity. The controller has a comment acknowledging this. |
| **Refresh Token** | `POST /refresh` | `POST /refresh` | ✅ **Matched.** Both endpoints allow for refreshing an existing JWT. |

#### Summary & Action Items

- **High-Level Alignment:** The overall route structure is well-aligned between the two services.
- **Critical Action:** The logic in `POST /auth/saml/callback` must be completed. It needs to call an `AuthService` method that:
  1. Finds an existing user or creates a new one based on SAML attributes.
  2. Generates a JWT token for the user.
  3. Redirects to the frontend, passing the token.
- **Minor Action:** Rename the `GET /auth/profile` endpoint to `GET /auth/me`.

### 2. Admin (`admin`)

**Status:** 🔴 Needs Attention

**Files Compared:**
- `backend/routes/admin.py`
- `backend-node/src/admin/admin.controller.ts`

#### Endpoint-to-Endpoint Comparison

| Feature Category | FastAPI Endpoint(s) | NestJS Endpoint(s) | Status & Analysis |
| :--- | :--- | :--- | :--- |
| **Admin User Mgmt.** | `GET /all`<br>`GET /{id}`<br>`POST /create`<br>`PUT /{id}`<br>`DELETE /{id}` | `GET /users`<br>`GET /users/{id}` (Implied)<br>`POST /users`<br>`PUT /users/{id}`<br>`DELETE /users/{id}` | ⚠️ **Logical Mismatch.** The NestJS endpoints are functionally different. For example, `GET /admin/users` fetches *all* users, not just admins as the FastAPI version does. The routing structure has also changed from `/admin/all` to `/admin/users`. The entire implementation needs to be revised to manage *admin* users specifically. |
| **System Prompt Mgmt.** | `GET /system-prompt`<br>`PUT /system-prompt` | `GET /system-prompts`<br>`POST /system-prompts`<br>`PUT /system-prompts/{id}`<br>`DELETE /system-prompts/{id}` | ❌ **Fundamental Design Change.** The original design has a **single global system prompt**. The new NestJS implementation has been built with full CRUD for **multiple system prompts**. This is a major deviation and requires a product/design decision: either revert to the single-prompt model or confirm this new functionality is desired. |

#### Summary & Action Items

- **Critical Security Gap:** The `AdminController` in NestJS is missing role-based access control. All its routes are accessible to any authenticated user, whereas they should be restricted to `SuperAdmin` only.
  - **✅ Solution:** The `RoleGuard` is already implemented. Apply it to the controller and routes.
    ```typescript
    // in admin.controller.ts
    import { RoleGuard, RequireRoles } from '../auth/guards/role.guard';
    import { UserRole } from '../models/user.model';
    
    @Controller('admin')
    @UseGuards(AuthGuard('jwt'), RoleGuard) // Apply RoleGuard here
    export class AdminController {
    
      @Get('users')
      @RequireRoles(UserRole.SUPER_ADMIN) // Apply Role Decorator here
      async getAllUsers(@Request() req) {
        // ...
      }
    
      // Apply @RequireRoles(UserRole.SUPER_ADMIN) to ALL other routes in this controller.
    }
    ```
- **Major Logic Mismatch (User Management):** The service logic for user management in `AdminService` needs to be rewritten to specifically target users with the `Admin` or `SuperAdmin` role, not all users. The endpoints should reflect this (e.g., `GET /admins` instead of `GET /users`).
- **Fundamental Design Difference (System Prompt):** A decision must be made whether to keep the new multi-prompt system or revert to the original single-prompt design to match the FastAPI backend. The current implementation does not match.

---

### 3. Agents (`agents`)

**Status:** 🔴 Needs Attention

**Files Compared:**
- `backend/routes/agents.py`
- `backend-node/src/agent/agent.controller.ts`
- `backend-node/src/agent/agent.service.ts`

#### Endpoint-to-Endpoint Comparison

| Feature | FastAPI Endpoint | NestJS Endpoint | Status & Analysis |
| :--- | :--- | :--- | :--- |
| **List Agents** | `GET /` | `GET /`<br>`GET /my-agents`<br>`GET /public` | ⚠️ **Design Change.** The single endpoint in FastAPI is replaced by three more specific endpoints in NestJS. This is a change in the API design but is functionally powerful. |
| **Get Templates** | `GET /templates` | `GET /templates` | ✅ **Matched.** |
| **Create Agent** | `POST /` | `POST /` | ✅ **Matched.** |
| **Create from Template** | `POST /from-template` | `POST /from-template` | ✅ **Matched.** |
| **Get Agent by ID** | `GET /{id}` | `GET /:id` | ❌ **Critical Security Gap.** The NestJS endpoint **does not verify user access**. Any authenticated user can fetch any other user's private agent. |
| **Update Agent** | `PUT /{id}` | `PUT /:id` | ✅ **Matched.** The authorization check (ownership) is correctly handled in the `AgentService`. |
| **Delete Agent** | `DELETE /{id}` | `DELETE /:id` | ✅ **Matched.** The ownership check is correctly handled in the `AgentService`. |
| **Use Agent** | `POST /{id}/use` | `POST /:id/use` | ❌ **Critical Security Gap.** The NestJS endpoint **does not verify user access** before incrementing the usage count. |
| **Rate Agent** | `POST /{id}/rate` | `POST /:id/rate` | ✅ **Matched.** Access control (public or owner) is correctly handled in the `AgentService`. |

#### New Features in NestJS

- `GET /search`: Endpoint for searching agents.
- `GET /:id/stats`: Endpoint for retrieving usage statistics for an agent.
- `GET /health`: A service health check endpoint.

#### Summary & Action Items

- **Critical Security Gap (Get Agent):** The `getAgentById` flow is insecure.
  - **✅ Solution:**
    1. The `getAgentById` method in `AgentService` must be modified to accept a `user` object.
    2. Inside the service method, add the authorization logic: `if (!agent.isPublic && agent.createdBy.toString() !== user.id) { throw new ForbiddenException(...) }`
    3. The `getAgentById` method in `AgentController` must pass the `req.user` object to the service.
- **Critical Security Gap (Use Agent):** The `incrementUsageCount` flow is insecure.
  - **✅ Solution:**
    1. The `incrementUsageCount` method in `AgentService` must be modified to accept a `user` object.
    2. Before incrementing, the service must first fetch the agent and perform the same access check as above.
    3. The `incrementUsageCount` method in `AgentController` must pass the `req.user` object to the service.
- **API Design Change:** The agent list endpoint has been redesigned. This should be communicated and confirmed if it's the desired behavior.

---

### 4. Bedrock (`bedrock`)

**Status:** ❌ Total Mismatch / Not Migrated

**Files Compared:**
- `backend/routes/bedrock.py`
- `backend-node/src/bedrock/bedrock.controller.ts`

#### Summary

There is **zero functional overlap** between the FastAPI and NestJS `bedrock` modules. This is not a migration; the NestJS version is a completely new and different service that happens to share the same name.

#### FastAPI Service (`bedrock.py`)
- **Purpose:** Provides high-level, application-specific features.
- **Endpoints:**
  - `POST /converse-stream`: A dedicated endpoint for streaming conversational chat, accepting structured message history, system prompts, and tool configurations. This is a core feature for the application's chat functionality.
  - `POST /generate-image`: A text-to-image generation endpoint.
- **Authentication:** None (likely handled by a gateway or internal-only).

#### NestJS Service (`bedrock.controller.ts`)
- **Purpose:** Provides a low-level, generic utility/management API for Bedrock.
- **Endpoints:**
  - `GET /models`: Lists available models.
  - `POST /invoke`: Generic, non-streaming model invocation with a simple prompt.
  - `POST /invoke-streaming`: Generic model streaming with a simple prompt.
  - `GET /models/:id`: Gets info for a specific model.
  - `POST /calculate-cost`: Utility to calculate invocation costs.
- **Authentication:** All routes are protected by JWT Auth.

#### Gaps & Action Items

- **Complete Feature Gap:** The two primary features of the original service are **completely missing** in the NestJS backend:
  1. **Conversational Streaming Chat:** The `POST /converse-stream` logic has not been migrated. The generic `invoke-streaming` is not a replacement as it lacks the conversational structure (message history, system prompts, etc.).
  2. **Image Generation:** The `POST /generate-image` endpoint has not been migrated.
- **Conclusion:** This module cannot be considered "migrated" in any sense. The critical application-level logic from `backend/routes/bedrock.py` needs to be built from scratch in the NestJS backend to achieve feature parity.

---

### 5. Chat (`chat` & `websocket`)

**Status:** 🟡 In Progress / Incomplete

**Files Compared:**
- `backend/routes/chat.py`
- `backend-node/src/chat/chat.controller.ts`
- `backend-node/src/websocket/websocket.gateway.ts`

#### Summary

The `Chat` module migration is a mixed success. The overall architecture has been correctly replicated, but the core WebSocket logic is functionally incomplete.

#### HTTP Endpoints (`chat.controller.ts`)
- **Status:** ✅ **Mostly Matched.**
- **Analysis:** The REST API for managing chat history (get, delete, update name, pin) is fully implemented and appears to match the FastAPI version's functionality. The required `userId` is passed to the service layer for authorization, which is correct.
- **Minor Improvement:** The `GET /memory/stats` route has an inline role check. This should be refactored to use the `@RequireRoles()` decorator for consistency.

#### WebSocket Logic (`websocket.gateway.ts`)
- **Status:** 🔴 **Architecturally Sound but Functionally Incomplete.**
- **What Matches:**
  - **Authentication:** Correctly authenticates via JWT from headers.
  - **Background Task Delegation:** Correctly uses a `TaskQueueService` to offload LLM processing from the main event loop, mirroring the Celery implementation in FastAPI. This is a critical and successful part of the migration.
  - **Real-time Pub/Sub:** Correctly uses a `RedisPubSubService` for broadcasting, enabling horizontal scaling.
- **What's Missing (Critical Gaps):**
  - The initial message handling logic (`join_room`, `create_room`) is stubbed out with `// TODO` comments.
  - `handleJoinRoom` is missing the **authorization check** to ensure a user can access the requested chat.
  - `handleCreateRoom` is missing the **database logic** to create a new chat entity, load the selected agent's configuration, and clear Redis memory. It currently uses mock data.
  
#### Conclusion

The most difficult parts of the architecture (background tasks, pub/sub) have been correctly designed in the NestJS backend. However, the service is not yet functional because the core session setup logic in the WebSocket gateway has not been fully implemented. The `// TODO` comments in `websocket.gateway.ts` provide a clear roadmap for what needs to be completed.

---

### 6. Collection (`collection`)

**Status:** 🟡 In Progress / Incomplete

**Files Compared:**
- `backend/routes/collection.py`
- `backend-node/src/collection/collection.controller.ts`

#### Summary

This module is an excellent example of a well-executed migration in terms of controller logic, security, and structure. However, it is fundamentally incomplete as it lacks the integration with the ChromaDB vector store, which is essential for its core functionality.

#### Endpoint-to-Endpoint Comparison
| Feature | FastAPI Endpoint | NestJS Endpoint | Status & Analysis |
| :--- | :--- | :--- | :--- |
| **List User Collections**| `GET /` | `GET /` | ✅ **Matched.** |
| **List Public Collections**| `GET /public` | `GET /public` | ✅ **Matched.** |
| **Create Collection** | `POST /` | `POST /` | ✅ **Matched.** |
| **Update Collection** | `PUT /{id}` | `PUT /:collection_id`| ✅ **Matched.** Auth checks are correctly implemented in the controller. |
| **Delete Collection** | `DELETE /{id}` | `DELETE /:collection_id`| ✅ **Matched.** Auth checks are correctly implemented. |
| **Get Documents** | `GET /{id}/documents` | `GET /:collection_id/documents` | ❌ **Incomplete.** The NestJS endpoint is a stub. It contains a `// TODO` and does not integrate with ChromaDB to fetch documents. |
| **Delete Documents** | `DELETE /{id}/documents` | `DELETE /:collection_id/documents` | ❌ **Incomplete.** Like getting documents, this endpoint is a stub and does not actually delete documents from ChromaDB. |
| **Get Analytics** | `GET /analytics` | `GET /analytics` | ⚠️ **Likely Incomplete.** The endpoint exists, but the service method it calls (`getCollectionAnalytics`) would depend on ChromaDB access to calculate document counts, which is not yet implemented. |

#### Conclusion

The controller-level logic for this module is complete and secure. The migration is on the right track. However, the entire service is non-functional without the implementation of a `ChromaService` (or equivalent) and its integration into the `CollectionService` and `CollectionController` to handle document storage and retrieval.

---

### 7. Department (`department`)

**Status:** 🔴 Needs Attention

**Files Compared:**
- `backend/routes/department.py`
- `backend-node/src/department/department.controller.ts`

#### Summary
The migration for the `Department` module has introduced a critical security vulnerability and is missing functionality.

#### Endpoint-to-Endpoint Comparison
| Feature | FastAPI Endpoint | NestJS Endpoint | Status & Analysis |
| :--- | :--- | :--- | :--- |
| **Get All Departments** | `GET /` | `GET /` | ⚠️ **Auth Mismatch.** FastAPI endpoint is public. NestJS requires any authenticated user. |
| **Get Department by ID**| `GET /{id}` | (none) | ❌ **Missing.** The endpoint to fetch a single department does not exist in the NestJS version. |
| **Create Department** | `POST /` | `POST /` | ❌ **Critical Security Gap.** FastAPI requires a `SuperAdmin`. NestJS allows **any authenticated user** to create a department. |
| **Update Department** | `PUT /{id}` | `PUT /:id`| ❌ **Critical Security Gap.** FastAPI requires a `SuperAdmin`. NestJS allows **any authenticated user** to update a department. |
| **Delete Department** | `DELETE /{id}` | `DELETE /:id`| ❌ **Critical Security Gap.** FastAPI requires a `SuperAdmin`. NestJS allows **any authenticated user** to delete a department. |

#### Conclusion & Action Items

- **Critical Security Gap:** The CUD (Create, Update, Delete) endpoints are insecure. They must be protected so that only a `SuperAdmin` can access them.
  - **✅ Solution:** Apply the `RoleGuard` and `@RequireRoles(UserRole.SUPER_ADMIN)` decorator to the `POST /`, `PUT /:id`, and `DELETE /:id` routes in `department.controller.ts`.
- **Missing Functionality:** The `GET /:id` endpoint needs to be implemented.
- **Auth Mismatch:** A decision should be made whether `GET /` should be public or require authentication, to align with the intended design.

---

### 8. Embedding (`embedding`)

**Status:** ❌ Total Mismatch / Not Migrated

**Files Compared:**
- `backend/routes/embedding.py`
- `backend-node/src/embedding/embedding.controller.ts`

#### Summary
This is another case of a total functional mismatch. The original service has not been migrated; it has been replaced by a completely new service with a different purpose.

#### FastAPI Service (`embedding.py`)
- **Purpose:** A pure computational utility.
- **Endpoint:**
  - `POST /embedding`: Takes a list of strings and uses the `bedrock_service` to return their vector embeddings.
- **Authentication:** None.

#### NestJS Service (`embedding.controller.ts`)
- **Purpose:** A full CRUD and search management API for a vector database (presumably ChromaDB).
- **Endpoints:**
  - `POST /search`: Searches a collection.
  - `POST /documents`, `DELETE /documents`, `GET /documents/:collection`: Manages documents within a collection.
  - `POST /collections`, `DELETE /collections/:name`, `GET /collections/:name/info`: Manages collections themselves.
- **Authentication:** All routes are protected by JWT Auth.

#### Conclusion & Action Items

- **Complete Feature Gap:** The sole function of the original module—**computing text embeddings**—is completely missing in the NestJS backend.
- **Structural Confusion:** The new `EmbeddingController` appears to implement the backend logic for ChromaDB integration that was noted as **missing** in the `Collection` module analysis. This suggests a significant structural problem in the new backend:
  - The logic for managing documents in a collection should reside within the `Collection` module (`CollectionController` and `CollectionService`).
  - Creating a separate `/embeddings` API for this purpose breaks the logical domain structure and does not match the original, more coherent API design.
- **Recommendation:**
  1. The embedding computation functionality from `backend/routes/embedding.py` needs to be created in the NestJS backend.
  2. The CRUD/search logic currently in `EmbeddingController` should be **moved** into the `CollectionService` and exposed through the `CollectionController` to fix the structural issue and fill the gap identified in that module's analysis. The current `EmbeddingController` should likely be deleted after its logic is migrated.

---

### 9. Stats (`stats`)

**Status:** ✅ Mostly Matched

**Files Compared:**
- `backend/routes/stats.py`
- `backend-node/src/stats/stats.controller.ts`

#### Summary
The core statistical functionality has been successfully migrated. The NestJS version also includes new, useful endpoints. The only issue is a minor code style inconsistency in how authorization is handled.

#### Endpoint-to-Endpoint Comparison
| Feature | FastAPI Endpoint | NestJS Endpoint | Status & Analysis |
| :--- | :--- | :--- | :--- |
| **Get Daily Stats** | `GET /stats` | `GET /` | ✅ **Matched.** |
| **Get Total Stats** | `GET /stats/total`| `GET /total` | ✅ **Matched.** |
| **Get Daily Chat Stats**| `GET /stats/daily`| `GET /daily` | ✅ **Matched.** |

#### New Features in NestJS
- `GET /user`: A new endpoint to get stats for the currently authenticated user.
- `GET /health`: A new endpoint to get a system health check.

#### Conclusion & Action Items

- **Functionally Complete:** The migration for this module is successful.
- **Code Style Improvement:** The authorization checks in `stats.controller.ts` are implemented inline (e.g., `if (!req.user.role || ...)`). For consistency and maintainability, these should be refactored to use the `@RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)` decorator, which is the standard pattern used elsewhere in the application.

---

### 10. Training (`training`)

**Status:** ✅ Mostly Matched

**Files Compared:**
- `backend/routes/training.py`
- `backend-node/src/training/training.controller.ts`

#### Summary
This module is a successful and near-perfect migration. All endpoints and their functionalities are correctly implemented in the NestJS backend.

#### Endpoint-to-Endpoint Comparison
| Feature | FastAPI Endpoint | NestJS Endpoint | Status & Analysis |
| :--- | :--- | :--- | :--- |
| **Upload & Process File**| `POST /upload` | `POST /upload` | ✅ **Matched.** |
| **Scrape & Process URL**| `POST /scrape-url` | `POST /scrape-url` | ✅ **Matched.** |
| **Process Raw Text** | `POST /text` | `POST /text` | ✅ **Matched.** |
| **Ingest Directory** | `POST /ingest-directory`| `POST /ingest-directory`| ✅ **Matched.** Both versions correctly identify this as a background task for Admins only. |

#### Conclusion & Action Items

- **Functionally Complete:** The migration for this module is successful.
- **Code Style Improvement:** The `ingest-directory` route uses an inline role check (`if (!req.user.role || ...)`). This should be refactored to use the standard `@RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)` decorator for consistency.

---

### 11. Upload (`upload`)

**Status:** ⚠️ Needs Attention

**Files Compared:**
- `backend/routes/upload.py`
- `backend-node/src/upload/upload.controller.ts`
- `backend-node/src/upload/upload.service.ts`

#### Summary
The high-level feature of file uploading is present, but the underlying implementation has a critical architectural difference that makes the NestJS version less robust and not suitable for a multi-instance production environment.

#### Endpoint-to-Endpoint Comparison
| Feature | FastAPI Endpoint | NestJS Endpoint | Status & Analysis |
| :--- | :--- | :--- | :--- |
| **Upload Single File** | `POST /upload` | `POST /single` | ⚠️ **Architectural Mismatch.** See below. |
| **Upload Multiple Files**| (none) | `POST /multiple` | ✨ **New Feature.** A useful addition. |

#### Gaps & Action Items
- **Critical Architectural Mismatch (Storage):**
  - The FastAPI version uses a `storage_service`, implying it uploads files to a shared object storage (like S3, MinIO, etc.). This is a scalable approach suitable for production.
  - The NestJS version uses `fs.writeFileSync` to save files to the **local server disk**. This approach is not scalable. If the application runs on more than one server instance, files uploaded to one instance will not be available on the others, leading to broken requests.
  - **✅ Solution:** The `UploadService` in NestJS must be refactored to upload files to a shared object storage, matching the original architecture.
- **Configuration Mismatch (File Size):**
  - FastAPI has a **10MB** file size limit.
  - NestJS has a **50MB** file size limit.
  - **✅ Solution:** The `maxFileSize` variable in `upload.service.ts` should be changed to `10 * 1024 * 1024` to match.

---

## Final Migration Summary

The migration from FastAPI to NestJS is well underway, with many modules showing a good structural and functional match. However, several critical gaps, security vulnerabilities, and architectural changes have been identified that must be addressed before the migration can be considered complete.

### High-Priority Action Items (Blocking Issues)
1.  **Auth - Incomplete SAML Login:** The `saml/callback` logic in `AuthController` is incomplete. It **must** be updated to create a user session and generate a JWT token. (Module: `auth`)
2.  **Admin - Missing Role-Based Auth:** The `AdminController` is missing `SuperAdmin` role checks on all CUD endpoints, creating a critical security vulnerability. (Module: `admin`)
3.  **Agent - Missing Authorization:** The `getAgentById` and `incrementUsageCount` flows are insecure, allowing any user to access or modify any agent. They need ownership/access checks. (Module: `agents`)
4.  **Bedrock & Embedding - Missing Core Functionality:** The `Bedrock` and `Embedding` modules are **not migrated**. Their core features (conversational chat, image generation, embedding computation) are completely missing and must be built. The logic in the new `EmbeddingController` seems misplaced and should be moved to the `Collection` module. (Modules: `bedrock`, `embedding`, `collection`)
5.  **Collection - Missing Vector DB Integration:** The `Collection` module is non-functional as it lacks the integration with ChromaDB for document management. (Module: `collection`)
6.  **Upload - Local Storage Implementation:** The `Upload` service's use of local disk storage is not scalable and must be replaced with an object storage solution to match the original architecture. (Module: `upload`)
7.  **Department - Missing Role-Based Auth:** The `DepartmentController` has the same security vulnerability as the `AdminController` and needs to be restricted to `SuperAdmin`. (Module: `department`)

### Medium-Priority Action Items (Code Quality & Consistency)
- Refactor all inline role-based authorization checks (e.g., in `StatsController`, `TrainingController`) to use the standard `@RequireRoles()` decorator.
- Ensure all configuration values (like file size limits) are consistent with the original application.
- Resolve API endpoint name mismatches (e.g., `/auth/profile` should be `/auth/me`).

### Conclusion
The new NestJS backend has a solid foundation, and in many places, the migration is excellent (`Stats`, `Training`). However, the number and severity of the identified issues—particularly regarding security and missing core functionality—mean that significant work is still required. This report should serve as a comprehensive checklist for the remaining development and refactoring efforts.
