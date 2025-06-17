import { Document, Schema, model } from 'mongoose';

export enum CollectionPermission {
  PUBLIC = 'PUBLIC',
  PRIVATE = 'PRIVATE'
}

export interface ICollection {
  name: string;
  description?: string; // User-provided description
  summary?: string;     // LLM-generated summary of all documents (L2)
  permission: string;
  createdBy: string;
  createdAt?: Date;  // Optional since Mongoose adds it automatically
  updatedAt?: Date;  // Optional since Mongoose adds it automatically
  // add other fields as needed
}

export type CollectionDocument = ICollection & Document;

const collectionSchema = new Schema<CollectionDocument>({
  name: { type: String, required: true },
  description: { type: String },
  summary: { type: String },
  permission: { type: String, required: true },
  createdBy: { type: String, required: true },
  // add default values if needed
}, { timestamps: true });

export const CollectionModel = model<CollectionDocument>('Collection', collectionSchema);  