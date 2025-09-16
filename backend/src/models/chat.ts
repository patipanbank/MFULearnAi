import mongoose, { Document, Schema } from 'mongoose';

export interface ImagePayload {
  url: string;
  mediaType: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  images?: ImagePayload[];
  isStreaming?: boolean;
  isComplete?: boolean;
  isDeleted?: boolean;
  deletedAt?: Date;
}

export interface Chat extends Document {
  userId: string;
  name: string;
  messages: ChatMessage[];
  agentId?: string;
  modelId?: string;
  collectionNames?: string[];
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ImagePayloadSchema = new Schema<ImagePayload>({
  url: { type: String, required: true },
  mediaType: { type: String, required: true }
});



const ChatMessageSchema = new Schema<ChatMessage>({
  id: { type: String, required: true },
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: false,
    default: '',
    validate: {
      validator: function(v: string) {
        return v !== undefined && v !== null;
      },
      message: 'Content cannot be undefined or null'
    }
  },
  timestamp: { type: Date, default: Date.now },
  images: [ImagePayloadSchema],
  isStreaming: Boolean,
  isComplete: Boolean,
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date
});

const ChatSchema = new Schema<Chat>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true, default: 'Untitled Chat' },
  messages: [ChatMessageSchema],
  agentId: { type: String, index: true },
  modelId: String,
  collectionNames: [String],
  isPinned: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: Date,
  deletedBy: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Comprehensive indexes for better query performance

// Primary user queries (most common) - exclude deleted chats by default
ChatSchema.index({ userId: 1, isDeleted: 1, updatedAt: -1 }); // List user's active chats by recency
ChatSchema.index({ userId: 1, isDeleted: 1, isPinned: -1, updatedAt: -1 }); // Active pinned chats first
ChatSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 }); // User's active chats by creation time

// Agent-based queries
ChatSchema.index({ userId: 1, agentId: 1, isDeleted: 1, updatedAt: -1 }); // Active chats by specific agent
ChatSchema.index({ agentId: 1, isDeleted: 1, updatedAt: -1 }); // Agent usage analytics (active only)

// Search and filtering
ChatSchema.index({ userId: 1, isDeleted: 1, name: 1 }); // Search active chats by name
ChatSchema.index({ userId: 1, isDeleted: 1, modelId: 1 }); // Filter active chats by model
ChatSchema.index({ userId: 1, isDeleted: 1, collectionNames: 1 }); // Filter active chats by collections

// Soft delete specific queries
ChatSchema.index({ userId: 1, isDeleted: 1, deletedAt: -1 }); // User's deleted chats
ChatSchema.index({ isDeleted: 1, deletedAt: -1 }); // All deleted chats for admin
ChatSchema.index({ deletedBy: 1, deletedAt: -1 }); // Chats deleted by specific user

// Analytics and admin queries
ChatSchema.index({ isDeleted: 1, createdAt: -1 }); // Recent active chats across all users
ChatSchema.index({ isDeleted: 1, updatedAt: -1 }); // Recently active chats
ChatSchema.index({ agentId: 1, isDeleted: 1, createdAt: -1 }); // Agent usage over time (active only)

// Message queries (for message-level analytics) - consider message-level soft delete
ChatSchema.index({ 'messages.timestamp': -1, 'messages.isDeleted': 1 }); // Recent active messages
ChatSchema.index({ userId: 1, 'messages.role': 1, 'messages.isDeleted': 1 }); // Active message analytics

// Update the updatedAt field before saving
ChatSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const ChatModel = mongoose.model<Chat>('Chat', ChatSchema); 