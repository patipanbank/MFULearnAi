import mongoose, { Document, Schema } from 'mongoose';

export enum AgentToolType {
  FUNCTION = 'function',
  RETRIEVER = 'retriever',
  WEB_SEARCH = 'web_search',
  CALCULATOR = 'calculator'
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
  tags: { type: [String], default: [] },
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

// Indexes
AgentSchema.index({ createdBy: 1, isPublic: 1 });
AgentSchema.index({ isPublic: 1, usageCount: -1 });
AgentSchema.index({ tags: 1 });

AgentTemplateSchema.index({ category: 1 });
AgentTemplateSchema.index({ tags: 1 });

// Update the updatedAt field before saving
AgentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const AgentModel = mongoose.model<Agent>('Agent', AgentSchema);
export const AgentTemplateModel = mongoose.model<AgentTemplate>('AgentTemplate', AgentTemplateSchema);
export const AgentExecutionModel = mongoose.model<AgentExecution>('AgentExecution', AgentExecutionSchema); 