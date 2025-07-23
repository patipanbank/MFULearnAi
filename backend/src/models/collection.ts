import mongoose, { Document, Schema } from 'mongoose';

export enum CollectionPermission {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE',
  DEPARTMENT = 'DEPARTMENT',
}

export interface ICollection extends Document {
  name: string;
  permission: CollectionPermission;
  createdBy: string;
  department?: string;
  createdAt: Date;
  updatedAt: Date;
  modelId?: string;
}

const collectionSchema = new Schema<ICollection>({
  name: { type: String, required: true, unique: true },
  permission: { type: String, enum: Object.values(CollectionPermission), required: true },
  createdBy: { type: String, required: true },
  department: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  modelId: { type: String },
});

export const Collection = mongoose.model<ICollection>('Collection', collectionSchema); 