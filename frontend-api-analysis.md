# Frontend API Analysis Report

## Summary
จากการวิเคราะห์ codebase พบปัญหาหลัก 3 ประเด็น:

### 1. ❌ Hardcoded API Paths (ไม่ Universal)
มี **38+ API calls** ที่ใช้ hardcoded paths โดยไม่ผ่าน config

### 2. ❌ Mixed Path Patterns (ไม่สอดคล้อง)
- **Auth Service**: ใช้ `/api/auth/*` (ถูกต้อง)
- **Chat Service**: ใช้ `/chat/*` (ผิด! ควรเป็น `/api/chat/*`)
- **Collections/RAG**: ใช้ `/collections/*`, `/training/*` (ผิด! ควรเป็น `/api/rag/*`)
- **Agent Service**: ใช้ `/agents/*` (ผิด! ควรเป็น `/api/agents/*`)
- **Admin/Departments**: ใช้ `/admin/*`, `/departments/*` (ผิด! ควรเป็น `/api/auth/*`)
- **User Settings**: ใช้ `/user/*` (ผิด! ควรเป็น `/api/auth/*`)
- **Bedrock**: ใช้ `/bedrock/*` (ผิด! ควรเป็น `/api/rag/*` หรือ service อื่น)

### 3. ❌ No Centralized API Service Layer
- ทุก component เรียก `api.get/post/put/delete` โดยตรง
- ไม่มี business logic layer
- ไม่มี type safety สำหรับ API responses
- ยากต่อการ mock, test, และ maintain

---

## Detailed Analysis by Service

### ✅ Auth Service (ถูกต้องแล้ว)
```typescript
// entities/user/store/index.ts:55
api.get<User>('/api/auth/me')           // ✅ ถูกต้อง
api.post<{token: string}>('/api/auth/refresh')  // ✅ ถูกต้อง
```
- ใช้ prefix `/api/auth` ตรงกับ ingress
- มี type safety

### ❌ Chat Service (ต้องแก้ไข)
```typescript
// shared/stores/chatStore.ts
api.post('/chat/update-name', ...)      // ❌ ต้องเป็น /api/chat/update-name
api.get<ChatSession>('/chat/history/${chatId}')  // ❌ ต้องเป็น /api/chat/history
api.post('/chat/save', ...)             // ❌ ต้องเป็น /api/chat/save
api.delete('/chat/${chatId}')           // ❌ ต้องเป็น /api/chat/${chatId}
api.post('/chat/${chatId}/pin', ...)    // ❌ ต้องเป็น /api/chat/${chatId}/pin
```
**Impact**: 5 API calls ที่ใช้ path ผิด

### ❌ Collections/RAG Service (ต้องออกแบบใหม่)
```typescript
// pages/KnowledgePage/index.tsx
api.get<Collection[]>('/collections/')           // ❌ ควรเป็น /api/rag/collections
api.get('/collections/analytics')                // ❌ ควรเป็น /api/rag/analytics
api.delete('/collections/${id}')                 // ❌ ควรเป็น /api/rag/collections/${id}
api.get('/collections/${id}/documents')          // ❌ ควรเป็น /api/rag/collections/${id}/documents
api.delete('/collections/${id}/documents')       // ❌ ควรเป็น /api/rag/collections/${id}/documents
api.post('/training/upload', ...)                // ❌ ควรเป็น /api/rag/upload หรือ /api/rag/train
api.get('/bedrock/models')                       // ❌ ควรเป็น /api/rag/models

// shared/ui/AgentModal/index.tsx
api.get<CollectionOption[]>('/collections/')     // ❌ ควรเป็น /api/rag/collections
api.get('/collections/public/')                  // ❌ ควรเป็น /api/rag/collections/public
```
**Impact**: 10+ API calls ที่ใช้ path ผิด

### ❌ Agent Service (ต้องแก้ไข)
```typescript
// shared/stores/agentStore.ts
api.get<any>('/agents/')                // ❌ ควรเป็น /api/agents/
api.post<any>('/agents/', ...)          // ❌ ควรเป็น /api/agents/
api.put<any>('/agents/${id}', ...)      // ❌ ควรเป็น /api/agents/${id}
api.delete('/agents/${id}')             // ❌ ควรเป็น /api/agents/${id}
```
**Impact**: 4 API calls ที่ใช้ path ผิด

### ❌ Admin/Department Service (ต้องแก้ไข)
```typescript
// pages/AdminPage/index.tsx
api.get<any>('/admin/analytics')                 // ❌ ควรเป็น /api/auth/admin/analytics
api.get<DepartmentStats>('/admin/departments/stats')  // ❌ ควรเป็น /api/auth/admin/departments/stats

// shared/ui/AdminUserModal/index.tsx
api.delete('/admin/users/${userId}')             // ❌ ควรเป็น /api/auth/admin/users
api.put('/admin/users/${id}', ...)               // ❌ ควรเป็น /api/auth/admin/users

// shared/ui/AdminDepartmentModal.tsx
api.get('/admin/departments?includeInactive=true')  // ❌ ควรเป็น /api/auth/admin/departments
api.put('/admin/departments/${id}', ...)         // ❌ ควรเป็น /api/auth/admin/departments
api.post('/admin/departments', ...)              // ❌ ควรเป็น /api/auth/admin/departments
api.delete('/admin/departments/${id}')           // ❌ ควรเป็น /api/auth/admin/departments
api.post('/admin/departments/recalculate')       // ❌ ควรเป็น /api/auth/admin/departments/recalculate

// shared/hooks/useDepartment.ts
api.get<Department>('/departments/${departmentId}')  // ❌ ควรเป็น /api/auth/departments
```
**Impact**: 12+ API calls ที่ใช้ path ผิด

### ❌ User Settings (ต้องแก้ไข)
```typescript
// shared/stores/settingsStore.ts
api.get('/user/settings')               // ❌ ควรเป็น /api/auth/user/settings
api.put('/user/settings', ...)          // ❌ ควรเป็น /api/auth/user/settings
api.post('/user/settings/reset')        // ❌ ควรเป็น /api/auth/user/settings/reset
```
**Impact**: 3 API calls ที่ใช้ path ผิด

---

## Root Causes (สาเหตุของปัญหา)

### 1. **ไม่มี API Service Layer**
```typescript
// ❌ Current: ทุก component เรียก api ตรง ๆ
const data = await api.get('/chat/history');

// ✅ Should be: มี service layer
const data = await ChatService.getHistory();
```

### 2. **Config ถูกสร้างแต่ไม่ได้ใช้**
```typescript
// config/config.ts มี config.services.chat.fullUrl
// แต่ไม่มีใครใช้! ทุกคนเขียน hardcoded path
```

### 3. **ไม่มี Type Safety**
```typescript
// ❌ Current: ใช้ any หรือไม่ระบุ type
api.get<any>('/agents/')

// ✅ Should be: มี strict types
api.get<AgentResponse[]>('/api/agents/')
```

---

## Recommendations (คำแนะนำแก้ไข)

### Option A: Quick Fix (แก้ path ทั้งหมด)
**เวลา**: 2-3 ชั่วโมง
**ความยาก**: ง่าย
**ผลกระทบ**: ต่ำ

1. แก้ทุก API call ให้ใช้ prefix `/api/*` ที่ถูกต้อง
2. Map service ตาม ingress:
   - `/api/auth/*` → auth-service
   - `/api/chat/*` → chat-service
   - `/api/agents/*` → agent-service (future)
   - `/api/rag/*` → rag-service (collections, training, bedrock)

**Pros**:
- แก้เร็ว
- ใช้ได้ทันที

**Cons**:
- ยังมี technical debt
- ยังไม่มี type safety
- ยังไม่ universal

---

### Option B: Refactor with Service Layer (แนะนำ!)
**เวลา**: 1-2 วัน
**ความยาก**: ปานกลาง
**ผลกระทบ**: กลาง (ต้อง refactor component)

#### 1. สร้าง API Service Layer
```typescript
// services/api/ChatService.ts
export class ChatService {
  private static baseUrl = config.services.chat.fullUrl;

  static async getHistory(): Promise<ChatSession[]> {
    return api.get<ChatSession[]>(`${this.baseUrl}/history`);
  }

  static async getChat(chatId: string): Promise<ChatSession> {
    return api.get<ChatSession>(`${this.baseUrl}/history/${chatId}`);
  }

  static async saveChat(session: ChatSession): Promise<void> {
    return api.post(`${this.baseUrl}/save`, session);
  }

  static async deleteChat(chatId: string): Promise<void> {
    return api.delete(`${this.baseUrl}/${chatId}`);
  }

  static async updateChatName(chatId: string, name: string): Promise<void> {
    return api.post(`${this.baseUrl}/update-name`, { chat_id: chatId, name });
  }

  static async pinChat(chatId: string, isPinned: boolean): Promise<void> {
    return api.post(`${this.baseUrl}/${chatId}/pin`, { isPinned });
  }
}

// services/api/AgentService.ts
export class AgentService {
  private static baseUrl = config.services.agent.fullUrl;

  static async getAgents(): Promise<AgentConfig[]> {
    return api.get<AgentConfig[]>(this.baseUrl);
  }

  static async getAgent(id: string): Promise<AgentConfig> {
    return api.get<AgentConfig>(`${this.baseUrl}/${id}`);
  }

  static async createAgent(config: Omit<AgentConfig, 'id'>): Promise<AgentConfig> {
    return api.post<AgentConfig>(this.baseUrl, config);
  }

  static async updateAgent(id: string, updates: Partial<AgentConfig>): Promise<AgentConfig> {
    return api.put<AgentConfig>(`${this.baseUrl}/${id}`, updates);
  }

  static async deleteAgent(id: string): Promise<void> {
    return api.delete(`${this.baseUrl}/${id}`);
  }
}

// services/api/RAGService.ts (สำหรับ collections/training/bedrock)
export class RAGService {
  private static baseUrl = config.services.rag.fullUrl;

  static async getCollections(): Promise<Collection[]> {
    return api.get<Collection[]>(`${this.baseUrl}/collections`);
  }

  static async getPublicCollections(): Promise<Collection[]> {
    return api.get<Collection[]>(`${this.baseUrl}/collections/public`);
  }

  static async getCollection(id: string): Promise<Collection> {
    return api.get<Collection>(`${this.baseUrl}/collections/${id}`);
  }

  static async createCollection(data: CreateCollectionDto): Promise<Collection> {
    return api.post<Collection>(`${this.baseUrl}/collections`, data);
  }

  static async deleteCollection(id: string): Promise<void> {
    return api.delete(`${this.baseUrl}/collections/${id}`);
  }

  static async getDocuments(collectionId: string): Promise<Document[]> {
    return api.get<Document[]>(`${this.baseUrl}/collections/${collectionId}/documents`);
  }

  static async uploadDocuments(data: FormData): Promise<any> {
    return api.post(`${this.baseUrl}/upload`, data);
  }

  static async getModels(): Promise<string[]> {
    return api.get<string[]>(`${this.baseUrl}/models`);
  }

  static async getAnalytics(): Promise<AnalyticsData> {
    return api.get<AnalyticsData>(`${this.baseUrl}/analytics`);
  }
}

// services/api/AuthService.ts (สำหรับ admin, departments, user settings)
export class AuthService {
  private static baseUrl = config.services.auth.fullUrl;

  // User management
  static async getMe(): Promise<User> {
    return api.get<User>(`${this.baseUrl}/me`);
  }

  static async refreshToken(): Promise<{token: string}> {
    return api.post<{token: string}>(`${this.baseUrl}/refresh`);
  }

  // User settings
  static async getUserSettings(): Promise<UserSettings> {
    return api.get<UserSettings>(`${this.baseUrl}/user/settings`);
  }

  static async updateUserSettings(settings: Partial<UserSettings>): Promise<void> {
    return api.put(`${this.baseUrl}/user/settings`, settings);
  }

  static async resetUserSettings(): Promise<void> {
    return api.post(`${this.baseUrl}/user/settings/reset`);
  }

  // Departments
  static async getDepartment(id: string): Promise<Department> {
    return api.get<Department>(`${this.baseUrl}/departments/${id}`);
  }

  // Admin - Analytics
  static async getAdminAnalytics(): Promise<SystemAnalytics> {
    return api.get<SystemAnalytics>(`${this.baseUrl}/admin/analytics`);
  }

  static async getDepartmentStats(): Promise<DepartmentStats> {
    return api.get<DepartmentStats>(`${this.baseUrl}/admin/departments/stats`);
  }

  // Admin - User Management
  static async getAdminUsers(params?: any): Promise<{users: User[], total: number}> {
    return api.get(`${this.baseUrl}/admin/users`, { params });
  }

  static async updateAdminUser(userId: string, data: any): Promise<User> {
    return api.put<User>(`${this.baseUrl}/admin/users/${userId}`, data);
  }

  static async deleteAdminUser(userId: string): Promise<void> {
    return api.delete(`${this.baseUrl}/admin/users/${userId}`);
  }

  // Admin - Department Management
  static async getAdminDepartments(includeInactive?: boolean): Promise<{departments: Department[]}> {
    return api.get(`${this.baseUrl}/admin/departments`, {
      params: { includeInactive }
    });
  }

  static async createAdminDepartment(data: any): Promise<Department> {
    return api.post<Department>(`${this.baseUrl}/admin/departments`, data);
  }

  static async updateAdminDepartment(id: string, data: any): Promise<Department> {
    return api.put<Department>(`${this.baseUrl}/admin/departments/${id}`, data);
  }

  static async deleteAdminDepartment(id: string): Promise<void> {
    return api.delete(`${this.baseUrl}/admin/departments/${id}`);
  }

  static async recalculateDepartments(): Promise<void> {
    return api.post(`${this.baseUrl}/admin/departments/recalculate`);
  }
}

// services/api/index.ts (export ทั้งหมด)
export { ChatService } from './ChatService';
export { AgentService } from './AgentService';
export { RAGService } from './RAGService';
export { AuthService } from './AuthService';
```

#### 2. Refactor Stores/Components
```typescript
// ❌ Before: shared/stores/chatStore.ts
const chat = await api.get<ChatSession>(`/chat/history/${chatId}`);

// ✅ After: shared/stores/chatStore.ts
import { ChatService } from '../../services/api';
const chat = await ChatService.getChat(chatId);
```

**Pros**:
- ✅ Type-safe
- ✅ Easy to test (mock services)
- ✅ Single source of truth
- ✅ Easy to change backend URLs
- ✅ Better error handling
- ✅ Can add caching, retry logic
- ✅ Universal and reusable

**Cons**:
- ใช้เวลานานกว่า
- ต้อง refactor หลาย files

---

### Option C: API Path Helper (แบบพอใช้)
**เวลา**: 3-4 ชั่วโมง
**ความยาก**: ง่าย-ปานกลาง
**ผลกระทบ**: ต่ำ

```typescript
// shared/lib/apiPaths.ts
export const API_PATHS = {
  auth: {
    me: () => '/api/auth/me',
    refresh: () => '/api/auth/refresh',
    userSettings: () => '/api/auth/user/settings',
    resetSettings: () => '/api/auth/user/settings/reset',
    department: (id: string) => `/api/auth/departments/${id}`,
    admin: {
      analytics: () => '/api/auth/admin/analytics',
      departmentStats: () => '/api/auth/admin/departments/stats',
      users: () => '/api/auth/admin/users',
      user: (id: string) => `/api/auth/admin/users/${id}`,
      departments: () => '/api/auth/admin/departments',
      department: (id: string) => `/api/auth/admin/departments/${id}`,
      recalculate: () => '/api/auth/admin/departments/recalculate',
    }
  },
  chat: {
    history: () => '/api/chat/history',
    chat: (id: string) => `/api/chat/history/${id}`,
    save: () => '/api/chat/save',
    updateName: () => '/api/chat/update-name',
    delete: (id: string) => `/api/chat/${id}`,
    pin: (id: string) => `/api/chat/${id}/pin`,
  },
  agents: {
    list: () => '/api/agents',
    agent: (id: string) => `/api/agents/${id}`,
  },
  rag: {
    collections: () => '/api/rag/collections',
    publicCollections: () => '/api/rag/collections/public',
    collection: (id: string) => `/api/rag/collections/${id}`,
    documents: (collectionId: string) => `/api/rag/collections/${collectionId}/documents`,
    upload: () => '/api/rag/upload',
    models: () => '/api/rag/models',
    analytics: () => '/api/rag/analytics',
  }
} as const;

// Usage
import { API_PATHS } from '../../shared/lib/apiPaths';
const chat = await api.get<ChatSession>(API_PATHS.chat.chat(chatId));
```

**Pros**:
- Centralized paths
- Easy to change
- Type hints for autocomplete

**Cons**:
- ไม่มี type safety สำหรับ response
- ยังไม่มี business logic layer
- ยังต้อง handle error ทุกที่

---

## Migration Priority (ลำดับความสำคัญ)

### Phase 1: Critical Paths (ต้องแก้ก่อน)
1. **Chat Service** - 5 paths (core functionality)
2. **Auth Service** - 3 paths (user settings)

### Phase 2: Important Features
3. **RAG Service** - 10+ paths (collections, training)
4. **Agent Service** - 4 paths
5. **Admin Service** - 12+ paths

### Phase 3: Nice to Have
6. Add Service Layer
7. Add comprehensive types
8. Add error handling
9. Add caching

---

## Conclusion

Frontend มีปัญหาร้ายแรง 3 ประการ:
1. **Hardcoded paths everywhere** (38+ จุด)
2. **Inconsistent path patterns** (ไม่ตรงกับ ingress)
3. **No service layer** (ไม่ universal, ยาก maintain)

**คำแนะนำ**:
- ถ้าต้องการแก้เร็ว → **Option A** (2-3 ชั่วโมง)
- ถ้าต้องการ quality code → **Option B** (1-2 วัน) ← แนะนำ!
- ถ้าต้องการแบบพอใช้ → **Option C** (3-4 ชั่วโมง)

สำหรับ production-ready microservices ควรเลือก **Option B** เพราะ:
- Type-safe
- Testable
- Maintainable
- Scalable
- Universal (ใช้ซ้ำได้)
