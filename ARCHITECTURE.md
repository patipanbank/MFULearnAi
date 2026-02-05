# Chat System Architecture - MFU Learn AI

## System Context
- **System Name**: MFU Learn AI
- **Architecture Style**: Microservices (Dockerized)
- **Deployment**: Docker Compose (Local/VM) / Potential for K8s
- **Primary Use Case**: RAG-based AI Chat with Multi-Model Support (Claude 3/Haiku), Document Analysis, and Image Understanding.

## Chat Flow (Critical)

The request lifecycle for a chat interaction corresponds to the `POST /api/chat` endpoint on the Orchestrator.

### 1. Client → Entry Point
- **Request**: Client sends a POST request with JSON body (message, sessionId, modelId) or Multipart form-data (if files are attached).
- **Gateway (Nginx)**:
    -   Handles SSL termination.
    -   Enforces rate limits (`limit_req_zone`).
    -   Routes `/api/chat` to `orchestrator-service:8080`.
    -   **Security**: Strips strictly internal headers (`x-internal-key`, `x-user-id`) to prevent spoofing from public internet.
- **Authentication**:
    -   The request MUST include a `Authorization: Bearer <JWT>` header.
    -   **Orchestrator Middleware**: Validates the JWT signature using `JWT_SECRET`.
    -   If valid, extracts `userId`, `role`, and `department` into the request context.

### 2. Orchestrator Service
The **Orchestrator** is the central brain and handles state.
- **Preprocessing**:
    -   **Rate Limiting**: Checks Redis-based user quotas (e.g., 100 req/min for TEST, 30 for PROD).
    -   **File Handling**: If files are uploaded, streams them to **Knowledge Service** (`/parse` endpoint) to garner an "Intermediate Representation" (IR) of text/tables.
    -   **History Retrieval**: Fetches recent chat history from **Redis** (L1 Cache) or **MongoDB** (Persistent Storage).
- **RAG (Retrieval Augmented Generation)**:
    -   Constructs a search query from the user message.
    -   Calls **Knowledge Service** (`/search`) passing **User Context Headers** (`x-user-id`, `x-permission-level`) to ensure users only retrieve documents they are allowed to see.
- **Prompt Construction**:
    -   Fetches **System Prompts** (Core + Scenario) from Redis/MongoDB.
    -   Assembles final context: `[System Prompt] + [RAG Context] + [File Context] + [Chat History]` (Formatted for Claude 3).
- **Execution**:
    -   Forwards the assembled payload to **Bedrock Service** (`/api/bedrock/chat`).

### 3. Downstream Services
- **Bedrock Text Service**:
    -   **Role**: Stateless wrapper for AWS Bedrock Runtime.
    -   **Auth**: Verifies `x-internal-key` header sent by Orchestrator.
    -   **Function**: Streams response from AWS Bedrock (Claude 3.5 Sonnet / Haiku).
    -   **Telemetry**: Captures input/output token usage.
- **Knowledge Service**:
    -   **Role**: Manages ingestion, parsing (PDF/Docx), and retrieval.
    -   **Storage**: MinIO (Files), ChromaDB (Vectors), MongoDB (Metadata).
    -   **Security**: Enforces Access Control Lists (ACL) based on `x-user-id` and `x-department`.

### 4. Response Path
- **Streaming**: The Orchestrator pipes the configuration Server-Sent Events (SSE) stream from the Bedrock Service directly to the Client.
- **Post-Processing**:
    -   On stream completion (`[DONE]`), the Orchestrator asynchronously:
        -   Saves the full exchange (User + AI) to **Redis** (History Cache).
        -   Persists the transaction to **MongoDB** (Conversation Log).
        -   Logs usage metrics (Token counts) for analytics.
- **Error Handling**: Streaming errors are caught and sent as SSE `event: error` if the header hasn't been flushed, or logged silently if stream is mid-flight.

## Authentication & Authorization

### User Verification
- **Identity Provider**: Users authenticate via **SSO Service** (SAML/ADFS) or **OAuth Service** (Google).
- **Token**: Successful login issues a **JWT**.
- **Perimeter**: Nginx Gateway allows public access ONLY to Auth endpoints. All other routes require a valid JWT.

### Identity Propagation & Trust
- **Client → Gateway**: Carries `Authorization: Bearer <token>`.
- **Gateway → Services**: Passes the Bearer token through.
- **Orchestrator → Internal Services**:
    -   **Explicit Trust**: Uses a shared secret `x-internal-key` to prove identity to Bedrock/Knowledge services.
    -   **Context Propagation**: Manually injects `x-user-id`, `x-role`, `x-department` headers based on the validated JWT. This allows downstream services (like Knowledge) to perform fine-grained permission checks without re-verifying the JWT.

## Trust Boundaries

- **Public Internet | Edge Gateway (Nginx)**
    -   **Trusted**: None. All inputs suspect.
    -   **Action**: Rate limiting, WAF (basic), Header Stripping (`x-internal-key`, `x-user-id`).

- **Gateway | Orchestrator**
    -   **Trusted**: JWT signature.
    -   **Action**: Orchestrator validates JWT. If valid, the User Identity inside is trusted.

- **Orchestrator | Downstream (Bedrock/Knowledge)**
    -   **Trusted**: `x-internal-key` (Service-to-Service Trust).
    -   **Trusted**: User Context Headers (`x-user-id` etc) *if and only if* accompanied by valid internal key (or coming from internal network).

## Failure & Reliability Model

- **Retry Logic**:
    -   Orchestrator does **not** automatically retry LLM generation failures (to avoid cost spikes/latency).
    -   Client is expected to retry 5xx errors.
- **Timeouts**:
    -   Gateway: 60s default, 300s for Chat (to accommodate long generations).
    -   Orchestrator -> Bedrock: 120s timeout.
- **Partial Failure**:
    -   **Knowledge Service Failure**: If RAG search fails, the Orchestrator logs a warning but **proceeds** with the chat using only the model's internal knowledge. This "Fail Open" approach prioritizes responsiveness.
    -   **Redis Failure**: Falls back to MongoDB for history; if MongoDB fails, starts a fresh empty session (degraded mode).

## Data & State

- **Session Storage**:
    -   **Redis (`chat:{userId}:{sessionId}`)**: Stores the "Hot" history (last 50 messages) for fast context window construction. TTL 24h.
    -   **MongoDB (`conversations`)**: "Cold" storage for audit trails, analytics, and long-term history scrollback.
- **File Assets**:
    -   stored in **MinIO/S3** (Self-hosted object storage).
    -   Metadata in **MongoDB** (`Knowledge` collection).
    -   Vector embeddings in **ChromaDB**.
    -   **Ownership**: Strictly tied to `ownerId` (Personal) or `department` (Shared).

## Observability

- **Strategy**: Centralized Logging Service (`logger-service`).
- **Telemetry**:
    -   `logActivity()` helper in Orchestrator sends structured events (User Action, Token Usage, Latency) to Logger.
    -   **Correlation**: `sessionId` travels through the logs to trace a conversation flow.
- **Visibility**:
    -   Token usage is calculated by the Bedrock Service (parsed from AWS response headers) and aggregated in Orchestrator.

## Non-Goals
- **Zero-Trust Networking**: Services inside the docker network communicate over plain HTTP; mTLS is not enforced between internal containers.
- **Global High Availability**: The system is designed for a single-region deployment; no multi-region failover logic.
- **Real-time Collaboration**: Chat sessions are single-user owner; no multi-user chat rooms.

## Known Limitations / Tech Debt
- **Context Window Management**: Simple sliding window (last 50 messages, or max token trim) is used; no smart summarization of older history relative to current query.
- **Prompt Injection**: Basic system prompt instructions are the primary defense; no dedicated input firewall / sanitizer model.
- **File Parsing**: Dependency on simple libraries (`pdf-parse`, `mammoth`); complex PDFs (OCR-required) might yield poor textual context.
