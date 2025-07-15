import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AgentDocument = Agent & Document;

export enum AgentToolType {
  FUNCTION = 'function',
  RETRIEVER = 'retriever',
  WEB_SEARCH = 'web_search',
  CALCULATOR = 'calculator',
}

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class AgentTool {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, enum: AgentToolType })
  type: AgentToolType;

  @Prop({ type: Object, default: {} })
  config: any;

  @Prop({ default: true })
  enabled: boolean;
}

export const AgentToolSchema = SchemaFactory.createForClass(AgentTool);

export enum AgentExecutionStatus {
  IDLE = 'idle',
  THINKING = 'thinking',
  USING_TOOL = 'using_tool',
  RESPONDING = 'responding',
  ERROR = 'error',
}

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class TokenUsage {
  @Prop({ default: 0 })
  input: number;

  @Prop({ default: 0 })
  output: number;
}

export const TokenUsageSchema = SchemaFactory.createForClass(TokenUsage);

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class AgentExecution {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Agent' })
  agentId: Types.ObjectId;

  @Prop({ required: true })
  sessionId: string;

  @Prop({ enum: AgentExecutionStatus, default: AgentExecutionStatus.IDLE })
  status: AgentExecutionStatus;

  @Prop()
  currentTool?: string;

  @Prop({ default: 0 })
  progress: number;

  @Prop({ required: true, default: Date.now })
  startTime: Date;

  @Prop()
  endTime?: Date;

  @Prop({ type: TokenUsageSchema, default: () => ({ input: 0, output: 0 }) })
  tokenUsage: TokenUsage;
}

export const AgentExecutionSchema = SchemaFactory.createForClass(AgentExecution);

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class Agent {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  systemPrompt: string;

  @Prop({ required: true })
  modelId: string;

  @Prop({ type: [String], default: [] })
  collectionNames: string[];

  @Prop({ type: [AgentToolSchema], default: [] })
  tools: AgentTool[];

  @Prop({ default: 0.7 })
  temperature: number;

  @Prop({ default: 4000 })
  maxTokens: number;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ required: true, type: Types.ObjectId, ref: 'User' })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;

  @Prop({ default: 0 })
  usageCount: number;

  @Prop({ default: 0.0 })
  rating: number;
}

export const AgentSchema = SchemaFactory.createForClass(Agent);

// Add indexes
AgentSchema.index({ name: 1 });
AgentSchema.index({ modelId: 1 });
AgentSchema.index({ createdBy: 1 });
AgentSchema.index({ isPublic: 1 });
AgentSchema.index({ tags: 1 });
AgentSchema.index({ createdAt: -1 });
AgentSchema.index({ usageCount: -1 });
AgentSchema.index({ rating: -1 });

// Pre-save middleware to update the updatedAt field
AgentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Pre-update middleware to update the updatedAt field
AgentSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: function(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class AgentTemplate {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  category: string;

  @Prop({ required: true })
  icon: string;

  @Prop({ required: true })
  systemPrompt: string;

  @Prop({ type: [String], default: [] })
  recommendedTools: string[];

  @Prop({ type: [String], default: [] })
  recommendedCollections: string[];

  @Prop({ type: [String], default: [] })
  tags: string[];
}

export const AgentTemplateSchema = SchemaFactory.createForClass(AgentTemplate); 