# 5. Service/Component Design & API Specification

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
