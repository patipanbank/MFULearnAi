import mongoose, { Document, Schema } from 'mongoose';

export enum AgentToolType {
  FUNCTION = 'function',
  RETRIEVER = 'retriever',
  WEB_SEARCH = 'web_search',
  CALCULATOR = 'calculator',
  CURRENT_DATE = 'current_date',
  MEMORY_SEARCH = 'memory_search',
  MEMORY_EMBED = 'memory_embed'
}

export enum AgentExecutionStatus {
  IDLE = 'idle',
  THINKING = 'thinking',
  USING_TOOL = 'using_tool',
  RESPONDING = 'responding',
  ERROR = 'error'
}

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  type: AgentToolType;
  config: Record<string, any>;
  enabled: boolean;
}

export interface TokenUsage {
  input: number;
  output: number;
}

export interface AgentExecution {
  id: string;
  agentId: string;
  sessionId: string;
  status: AgentExecutionStatus;
  currentTool?: string;
  progress: number;
  startTime: Date;
  endTime?: Date;
  tokenUsage: TokenUsage;
}

export interface Agent extends Document {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  collectionNames: string[];
  tools: AgentTool[];
  temperature: number;
  maxTokens: number;
  isPublic: boolean;
  tags: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  usageCount: number;
  rating: number;
}

export interface AgentTemplate extends Document {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  systemPrompt: string;
  recommendedTools: string[];
  recommendedCollections: string[];
  tags: string[];
}

const AgentToolSchema = new Schema<AgentTool>({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  type: { 
    type: String, 
    enum: Object.values(AgentToolType), 
    required: true 
  },
  config: { type: Schema.Types.Mixed, default: {} },
  enabled: { type: Boolean, default: true }
});

const TokenUsageSchema = new Schema<TokenUsage>({
  input: { type: Number, default: 0 },
  output: { type: Number, default: 0 }
});

const AgentExecutionSchema = new Schema<AgentExecution>({
  id: { type: String, required: true },
  agentId: { type: String, required: true },
  sessionId: { type: String, required: true },
  status: { 
    type: String, 
    enum: Object.values(AgentExecutionStatus), 
    default: AgentExecutionStatus.IDLE 
  },
  currentTool: String,
  progress: { type: Number, default: 0 },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  tokenUsage: { type: TokenUsageSchema, default: () => ({ input: 0, output: 0 }) }
});

const AgentSchema = new Schema<Agent>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  systemPrompt: { type: String, required: true },
  modelId: { type: String, required: true },
  collectionNames: { type: [String], default: [] },
  tools: { type: [AgentToolSchema], default: [] },
  temperature: { type: Number, default: 0.7 },
  maxTokens: { type: Number, default: 4000 },
  isPublic: { type: Boolean, default: false },
  tags: { type: [String], default: [] }, // Ensure tags is an array of strings with a default empty array
  createdBy: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  usageCount: { type: Number, default: 0 },
  rating: { type: Number, default: 0.0 }
});

const AgentTemplateSchema = new Schema<AgentTemplate>({
  name: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  icon: { type: String, required: true },
  systemPrompt: { type: String, required: true },
  recommendedTools: { type: [String], default: [] },
  recommendedCollections: { type: [String], default: [] },
  tags: { type: [String], default: [] }
});

// Comprehensive indexes for agents

// User and public queries
AgentSchema.index({ createdBy: 1, updatedAt: -1 }); // User's agents by recency
AgentSchema.index({ isPublic: 1, usageCount: -1 }); // Popular public agents
AgentSchema.index({ isPublic: 1, rating: -1 }); // Top rated public agents
AgentSchema.index({ isPublic: 1, createdAt: -1 }); // Recent public agents

// Search and filtering
AgentSchema.index({ tags: 1, isPublic: 1 }); // Tag-based filtering with public filter
AgentSchema.index({ modelId: 1, isPublic: 1 }); // Filter by model
AgentSchema.index({ name: 1, isPublic: 1 }); // Name search with public filter
AgentSchema.index({ 'collectionNames': 1, isPublic: 1 }); // Filter by collections

// Analytics queries
AgentSchema.index({ usageCount: -1 }); // Most used agents
AgentSchema.index({ rating: -1 }); // Highest rated agents
AgentSchema.index({ createdAt: -1 }); // Recently created agents

// Text search index for agent names and descriptions
AgentSchema.index({
  name: 'text',
  description: 'text'
}, {
  name: 'agent_text_search',
  weights: { name: 10, description: 5 } // Name is more important than description
});

// Agent templates
AgentTemplateSchema.index({ category: 1, name: 1 }); // Browse by category
AgentTemplateSchema.index({ tags: 1 }); // Filter by tags
AgentTemplateSchema.index({
  name: 'text',
  description: 'text',
  category: 'text'
}, {
  name: 'template_text_search'
});

// Agent execution indexes (for monitoring and analytics)
AgentExecutionSchema.index({ agentId: 1, startTime: -1 }); // Agent execution history
AgentExecutionSchema.index({ sessionId: 1, startTime: -1 }); // Session execution history
AgentExecutionSchema.index({ status: 1, startTime: -1 }); // Monitor running/failed executions
AgentExecutionSchema.index({ startTime: -1 }); // Recent executions across all agents

// Update the updatedAt field before saving
AgentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const AgentModel = mongoose.model<Agent>('Agent', AgentSchema);
export const AgentTemplateModel = mongoose.model<AgentTemplate>('AgentTemplate', AgentTemplateSchema);
export const AgentExecutionModel = mongoose.model<AgentExecution>('AgentExecution', AgentExecutionSchema); 