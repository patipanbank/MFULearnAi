import { Schema, Document } from 'mongoose';

export interface SystemPromptDocument extends Document {
  prompt: string;
  updatedBy: string;
  updatedAt: Date;
}

export const SystemPromptSchema = new Schema<SystemPromptDocument>({
  prompt: { type: String, required: true },
  updatedBy: { type: String, required: true },
  updatedAt: { type: Date, default: Date.now },
}); 