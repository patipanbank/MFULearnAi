import mongoose from 'mongoose';

interface ICollection {
  name: string;
  isPublic: boolean;
  createdBy: string; // userId
  created: Date;
  updated: Date;
}

const collectionSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    unique: true 
  },
  isPublic: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    required: true
  },
  created: {
    type: Date,
    default: Date.now
  },
  updated: {
    type: Date,
    default: Date.now
  }
});

export const Collection = mongoose.model('Collection', collectionSchema); 