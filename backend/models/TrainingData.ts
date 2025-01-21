import mongoose from 'mongoose';

const trainingDataSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  createdBy: {
    nameID: String,
    firstName: String,
    lastName: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('TrainingData', trainingDataSchema); 