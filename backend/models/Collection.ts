import mongoose, { Document } from 'mongoose';

export enum CollectionPermission {
  PUBLIC = 'PUBLIC',
  STAFF_ONLY = 'STAFF_ONLY',
  PRIVATE = 'PRIVATE'
}

export interface ICollection extends Document {
  _id: string;
  name: string;
  permission: CollectionPermission;
  createdBy: string;
  created: Date;
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

export const Collection = mongoose.model<ICollection>('Collection', collectionSchema);  