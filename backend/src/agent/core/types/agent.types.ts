export interface AgentConfig {
  modelId?: string;
  sessionId?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  toolNames?: string[];
}

export interface AgentCacheKey {
  modelId: string;
  systemPrompt: string;
  toolNames: string[];
  temperature: number;
  maxTokens: number;
}

export interface AgentCacheEntry {
  key: AgentCacheKey;
  executor: any;
  createdAt: Date;
  lastUsed: Date;
}

export interface AgentExecutorOptions {
  onEvent?: (event: { type: string; data?: any }) => void;
  maxSteps?: number;
  images?: Array<{ url: string; mediaType: string; base64Data?: string }>;
}

export interface AgentMessage {
  role: string;
  content: string;
}

export interface AgentStats {
  totalSessions: number;
  cachedAgents: number;
  cacheHits: number;
  cacheMisses: number;
}