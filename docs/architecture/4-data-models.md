# 4. Data Models

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
