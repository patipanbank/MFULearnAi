import mongoose from 'mongoose';

const trainingDataSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  createdBy: {
    nameID: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    firstName: {
      type: String
    },
    lastName: {
      type: String
    }
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