import { Schema, model, Document } from 'mongoose';

export interface ModelDocument extends Document {
  name: string;
  collections: string[];
  createdBy: string;
  modelType: 'official' | 'personal' | 'staff_only';
  createdAt: Date;
  updatedAt: Date;
}

const modelSchema = new Schema<ModelDocument>({
  name: { type: String, required: true },
  collections: [{ type: String }],
  createdBy: { type: String, required: true },
  modelType: { type: String, enum: ['official', 'personal', 'staff_only'], required: true },
}, { timestamps: true });

export const ModelModel = model<ModelDocument>('Model', modelSchema);