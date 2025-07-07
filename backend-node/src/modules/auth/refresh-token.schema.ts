import { Schema, Document } from 'mongoose';

export interface RefreshTokenDocument extends Document {
  userId: string;
  token: string;
  expiresAt: Date;
}

export const RefreshTokenSchema = new Schema<RefreshTokenDocument>({
  userId: { type: String, required: true },
  token: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
}); 