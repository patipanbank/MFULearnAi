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
    required: true,
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
  isComplete: Boolean
});

const ChatSchema = new Schema<Chat>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true, default: 'Untitled Chat' },
  messages: [ChatMessageSchema],
  agentId: { type: String, index: true },
  modelId: String,
  collectionNames: [String],
  isPinned: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for better query performance
ChatSchema.index({ userId: 1, createdAt: -1 });
ChatSchema.index({ userId: 1, isPinned: -1, updatedAt: -1 });

// Update the updatedAt field before saving
ChatSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const ChatModel = mongoose.model<Chat>('Chat', ChatSchema); 