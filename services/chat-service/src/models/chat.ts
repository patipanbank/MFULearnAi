import mongoose, { Document, Schema } from 'mongoose';

/**
 * Chat Models
 * MongoDB schemas for chat and message storage
 */

export interface ImagePayload {
  url: string;
  mediaType: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  images?: ImagePayload[];
  metadata?: Record<string, any>;
}

export interface Chat extends Document {
  userId: string;
  name: string;
  messages: ChatMessage[];
  agentId?: string;
  modelId?: string;
  collectionNames?: string[];
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ImagePayloadSchema = new Schema<ImagePayload>({
  url: { type: String, required: true },
  mediaType: { type: String, required: true },
});

const ChatMessageSchema = new Schema<ChatMessage>({
  id: { type: String, required: true },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true,
  },
  content: {
    type: String,
    required: true,
    default: '',
  },
  timestamp: { type: Date, default: Date.now },
  images: [ImagePayloadSchema],
  metadata: { type: Schema.Types.Mixed },
});

const ChatSchema = new Schema<Chat>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true, default: 'New Chat' },
  messages: [ChatMessageSchema],
  agentId: { type: String, index: true },
  modelId: String,
  collectionNames: [String],
  isPinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Indexes for better query performance
ChatSchema.index({ userId: 1, createdAt: -1 });
ChatSchema.index({ userId: 1, isPinned: -1, updatedAt: -1 });
ChatSchema.index({ userId: 1, updatedAt: -1 });

// Update the updatedAt field before saving
ChatSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

export const ChatModel = mongoose.model<Chat>('Chat', ChatSchema);
