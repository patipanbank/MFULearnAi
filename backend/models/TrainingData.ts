import mongoose from 'mongoose';

const trainingDataSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  knowledgeBaseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'KnowledgeBase',
    required: true
  },
  createdBy: {
    nameID: String,
    username: String,
    firstName: String,
    lastName: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  fileType: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model('TrainingData', trainingDataSchema); 