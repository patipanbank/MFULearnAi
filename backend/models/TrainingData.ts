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
  createdBy: {
    nameID: {
      type: String,
      required: true
    },
    username: {
      type: String,
      required: true
    },
    firstName: String,
    lastName: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  fileType: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export interface TrainingData extends mongoose.Document {
  name: string;
  content: string;
  createdBy: {
    nameID: string;
    username: string;
    firstName?: string;
    lastName?: string;
  };
  isActive: boolean;
  fileType?: string;
  createdAt: Date;
}

export default mongoose.model<TrainingData>('TrainingData', trainingDataSchema); 