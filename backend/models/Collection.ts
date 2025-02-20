import mongoose, { Document } from 'mongoose';

export enum CollectionPermission {
  PUBLIC = 'PUBLIC',
  STAFF_ONLY = 'STAFF_ONLY',
  PRIVATE = 'private'
}

export interface Collection extends Document {
  name: string;
  permission: CollectionPermission;
  createdBy: string;
  // Other properties if needed.
}

const collectionSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  permission: { 
    type: String,
    enum: Object.values(CollectionPermission),
    default: CollectionPermission.PRIVATE
  },
  createdBy: { type: String, required: true }, // nameID ของผู้สร้าง
  created: { type: Date, default: Date.now }
});

export const Collection = mongoose.model('Collection', collectionSchema); 