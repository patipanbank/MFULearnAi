// Agent System Types
export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  collections: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentRuntime {
  id: string;
  agent: Agent;
  status: 'idle' | 'thinking' | 'processing' | 'error';
  currentTask?: string;
  progress: number;
  metrics: {
    totalMessages: number;
    averageResponseTime: number;
    successRate: number;
    lastUsed: Date;
  };
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  category: 'search' | 'calculation' | 'web' | 'document' | 'custom';
  parameters: ToolParameter[];
  enabled: boolean;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
  required: boolean;
  default?: any;
}

export interface ToolExecution {
  id: string;
  toolId: string;
  parameters: Record<string, any>;
  result?: any;
  error?: string;
  duration: number;
  timestamp: Date;
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  prompt: string;
  suggestedTools: string[];
  suggestedCollections: string[];
  tags: string[];
}