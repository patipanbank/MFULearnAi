import mongoose from 'mongoose';

const knowledgeBaseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  baseModelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AIModel',
    required: true
  },
  collectionName: {
    type: String,
    required: true,
    unique: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('KnowledgeBase', knowledgeBaseSchema); 