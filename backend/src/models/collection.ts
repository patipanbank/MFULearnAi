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

// Add virtual id field for frontend compatibility
collectionSchema.virtual('id').get(function(this: Document) {
  return (this._id as mongoose.Types.ObjectId).toString();
});

// Ensure virtual fields are included in JSON output
collectionSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc: any, ret: any) {
    ret.id = ret._id;
    return ret;
  }
});

// Comprehensive indexes for collection queries

// Primary queries
collectionSchema.index({ permission: 1, updatedAt: -1 }); // List collections by permission and recency
collectionSchema.index({ createdBy: 1, updatedAt: -1 }); // User's collections by recency
collectionSchema.index({ department: 1, permission: 1 }); // Department collections with permission filter

// Access control queries
collectionSchema.index({ permission: 1, department: 1 }); // Department-level access
collectionSchema.index({ createdBy: 1, permission: 1 }); // User's collections with permission

// Analytics and admin
collectionSchema.index({ createdAt: -1 }); // Recent collections
collectionSchema.index({ updatedAt: -1 }); // Recently updated collections
collectionSchema.index({ modelId: 1 }); // Filter by model

// Text search for collection names
collectionSchema.index({
  name: 'text'
}, {
  name: 'collection_name_search'
});

// Update the updatedAt field before saving
collectionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Collection = mongoose.model<ICollection>('Collection', collectionSchema); 