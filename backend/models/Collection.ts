import mongoose from 'mongoose';

export enum CollectionPermission {
  PUBLIC = 'public',
  STAFF_ONLY = 'staff_only', 
  PRIVATE = 'private'
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