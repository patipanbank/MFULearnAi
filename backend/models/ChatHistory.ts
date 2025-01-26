import mongoose from 'mongoose';

interface IChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface IChatHistory {
  userId: string;
  modelId: string;
  collectionName: string;
  messages: IChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

const chatHistorySchema = new mongoose.Schema<IChatHistory>({
  userId: { type: String, required: true },
  modelId: { type: String, required: true },
  collectionName: { type: String, required: true },
  messages: [{
    id: { type: Number, required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, required: true }
  }],
}, { timestamps: true });

export const ChatHistory = mongoose.model<IChatHistory>('ChatHistory', chatHistorySchema); 