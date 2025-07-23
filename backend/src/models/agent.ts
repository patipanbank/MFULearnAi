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
  name: { 
    type: String, 
    required: [true, 'Agent name is required'],
    trim: true,
    maxlength: [100, 'Agent name cannot exceed 100 characters'],
    default: ''
  },
  description: { 
    type: String, 
    required: [true, 'Agent description is required'],
    trim: true,
    maxlength: [1000, 'Agent description cannot exceed 1000 characters'],
    default: ''
  },
  systemPrompt: { 
    type: String, 
    required: [true, 'System prompt is required'],
    trim: true,
    maxlength: [10000, 'System prompt cannot exceed 10000 characters'],
    default: ''
  },
  modelId: { 
    type: String, 
    required: [true, 'Model ID is required'],
    trim: true,
    default: ''
  },
  collectionNames: { 
    type: [String], 
    default: [],
    validate: {
      validator: function(v: string[]) {
        return Array.isArray(v) && v.every(item => typeof item === 'string');
      },
      message: 'Collection names must be an array of strings'
    }
  },
  tools: { 
    type: [AgentToolSchema], 
    default: [],
    validate: {
      validator: function(v: any[]) {
        return Array.isArray(v);
      },
      message: 'Tools must be an array'
    }
  },
  temperature: { 
    type: Number, 
    default: 0.7,
    min: [0, 'Temperature must be at least 0'],
    max: [2, 'Temperature cannot exceed 2']
  },
  maxTokens: { 
    type: Number, 
    default: 4000,
    min: [1, 'Max tokens must be at least 1'],
    max: [32000, 'Max tokens cannot exceed 32000']
  },
  isPublic: { 
    type: Boolean, 
    default: false 
  },
  tags: { 
    type: [String], 
    default: [],
    validate: {
      validator: function(v: string[]) {
        return Array.isArray(v) && v.every(item => typeof item === 'string' && item.length <= 50);
      },
      message: 'Tags must be an array of strings, each no longer than 50 characters'
    }
  },
  createdBy: { 
    type: String, 
    required: [true, 'Created by field is required'],
    trim: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  usageCount: { 
    type: Number, 
    default: 0,
    min: [0, 'Usage count cannot be negative']
  },
  rating: { 
    type: Number, 
    default: 0.0,
    min: [0, 'Rating cannot be negative'],
    max: [5, 'Rating cannot exceed 5']
  }
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