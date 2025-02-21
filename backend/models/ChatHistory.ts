import mongoose from 'mongoose';

interface IChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  images?: Array<{
    data: string;
    mediaType: string;
  }>;
  sources?: {
    modelId: string;
    collectionName: string;
    filename: string;
    similarity: number;
  }[];
}

interface IChatHistory {
  chatId: string;
  userId: string;
  modelId: string;
  collectionName: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  sources: {
    modelId: string;
    collectionName: string;
    documents: {
      filename: string;
      similarity: number;
    }[];
  }[];
}

const chatHistorySchema = new mongoose.Schema({
  chatId: { type: String, required: true },
  userId: { type: String, required: true },
  modelId: { type: String, default: '' },
  collectionName: { type: String, default: '' },
  messages: [{
    id: { type: Number, required: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    images: [{
      data: String,
      mediaType: String
    }],
    sources: [{
      modelId: String,
      collectionName: String,
      filename: String,
      similarity: Number
    }]
  }],
  sources: [{
    modelId: { type: String },
    collectionName: { type: String },
    documents: [{
      filename: { type: String },
      similarity: { type: Number }
    }]
  }]
}, { timestamps: true });

export const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema); 