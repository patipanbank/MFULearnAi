import { Schema, Document } from 'mongoose';

export enum AgentExecutionStatus {
  IDLE = 'idle',
  THINKING = 'thinking',
  USING_TOOL = 'using_tool',
  RESPONDING = 'responding',
  ERROR = 'error',
}

export interface AgentExecutionDocument extends Document {
  agentId: string;
  sessionId: string;
  status: AgentExecutionStatus;
  currentTool?: string;
  progress: number;
  startTime: Date;
  endTime?: Date;
  tokenUsage: { input: number; output: number };
}

export const AgentExecutionSchema = new Schema<AgentExecutionDocument>({
  agentId: { type: String, required: true },
  sessionId: { type: String, required: true },
  status: { type: String, enum: Object.values(AgentExecutionStatus), default: AgentExecutionStatus.IDLE },
  currentTool: { type: String },
  progress: { type: Number, default: 0 },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  tokenUsage: {
    input: { type: Number, default: 0 },
    output: { type: Number, default: 0 },
  },
}); 