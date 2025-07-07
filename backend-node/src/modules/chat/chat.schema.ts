import { Schema, Document, Types } from 'mongoose';

export interface MessageDocument extends Document {
  role: 'user' | 'assistant';
  content: string;
  images?: { url: string; mediaType: string }[];
  timestamp: Date;
}

export const MessageSchema = new Schema<MessageDocument>({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  images: [{ url: String, mediaType: String }],
  timestamp: { type: Date, default: Date.now },
});

export interface ChatDocument extends Document {
  userId: string;
  name: string;
  agentId?: string;
  messages: Types.DocumentArray<MessageDocument>;
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const ChatSchema = new Schema<ChatDocument>({
  userId: { type: String, required: true },
  name: { type: String, default: 'Untitled Chat' },
  agentId: { type: String },
  messages: [MessageSchema],
  isPinned: { type: Boolean, default: false },
}, { timestamps: true }); 