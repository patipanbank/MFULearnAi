import { Schema, Document } from 'mongoose';

export interface AgentDocument extends Document {
  name: string;
  description: string;
  systemPrompt: string;
  modelId: string;
  collectionNames: string[];
  temperature: number;
  maxTokens: number;
  isPublic: boolean;
  tags: string[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export const AgentSchema = new Schema<AgentDocument>({
  name: { type: String, required: true },
  description: { type: String },
  systemPrompt: { type: String, required: true },
  modelId: { type: String, required: true },
  collectionNames: [{ type: String }],
  temperature: { type: Number, default: 0.7 },
  maxTokens: { type: Number, default: 4000 },
  isPublic: { type: Boolean, default: false },
  tags: [{ type: String }],
  createdBy: { type: String },
}, { timestamps: true }); 