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

// Add unique index for collection names
collectionSchema.index({ name: 1 }, { unique: true });

// Add index for better query performance
collectionSchema.index({ createdBy: 1, permission: 1 });

// Add validation for collection name
collectionSchema.pre('save', function(next) {
  if (!this.name || this.name.trim().length === 0) {
    throw new Error('Collection name cannot be empty');
  }
  
  // Sanitize collection name (remove special characters that might cause issues)
  this.name = this.name.trim().replace(/[<>:"/\\|?*]/g, '_');
  
  next();
});

export const CollectionModel = model<CollectionDocument>('Collection', collectionSchema);  