import mongoose from 'mongoose';

interface ISource {
  modelId: string;
  collectionName: string;
  fileName: string;
  similarity: number;
}

interface IMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: ISource[];
}

interface IChatHistory {
  userId: string;
  title: string;
  messages: IMessage[];
  modelId?: string;
  collectionName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const sourceSchema = new mongoose.Schema<ISource>({
  modelId: { type: String, required: true },
  collectionName: { type: String, required: true },
  fileName: { type: String, required: true },
  similarity: { type: Number, required: true }
});

const messageSchema = new mongoose.Schema<IMessage>({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  sources: [sourceSchema]
});

const chatHistorySchema = new mongoose.Schema<IChatHistory>({
  userId: { type: String, required: true },
  title: { type: String, required: true },
  messages: [messageSchema],
  modelId: { type: String },
  collectionName: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true // เพิ่ม timestamps อัตโนมัติ
});

// ดึงข้อความแรกมาเป็นชื่อแชท
chatHistorySchema.pre('save', function(next) {
  if (this.isNew && this.messages.length > 0) {
    const firstMessage = this.messages[0].content;
    this.title = firstMessage.length > 50 
      ? firstMessage.substring(0, 50) + '...'
      : firstMessage;
  }
  next();
});

export const ChatHistory = mongoose.model<IChatHistory>('ChatHistory', chatHistorySchema); 