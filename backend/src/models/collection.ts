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

// Helpful indexes for frequent queries
collectionSchema.index({ permission: 1 });
collectionSchema.index({ department: 1 });
collectionSchema.index({ createdBy: 1 });

export const Collection = mongoose.model<ICollection>('Collection', collectionSchema); 