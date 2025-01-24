import mongoose from 'mongoose';

const trainingDataSchema = new mongoose.Schema({
  modelName: {
    type: String,
    required: true,
    index: true
  },
  documents: [{
    id: String,
    content: String,
    metadata: {
      creator: String,
      version: String,
      status: String,
      created_at: Date,
      updated_at: Date,
      source: String,
      type: String
    }
  }],
  creator: {
    type: String,
    required: true
  },
  version: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model('TrainingData', trainingDataSchema); 