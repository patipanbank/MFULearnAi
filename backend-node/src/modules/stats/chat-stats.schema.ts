import { Schema, Document } from 'mongoose';

export interface ChatStatsDocument extends Document {
  date: Date;
  uniqueUsers: string[];
  totalChats: number;
  totalTokens: number;
}

export const ChatStatsSchema = new Schema<ChatStatsDocument>({
  date: { type: Date, required: true, unique: true },
  uniqueUsers: [{ type: String }],
  totalChats: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
}); 