import { Schema, Document } from 'mongoose';
import { CollectionPermission } from './collection-permission.enum';

export interface CollectionDocument extends Document {
  name: string;
  permission: CollectionPermission;
  createdBy: string;
  department?: string;
  modelId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const CollectionSchema = new Schema<CollectionDocument>({
  name: { type: String, required: true, unique: true },
  permission: { type: String, enum: Object.values(CollectionPermission), required: true },
  createdBy: { type: String, required: true },
  department: { type: String },
  modelId: { type: String },
}, { timestamps: true }); 