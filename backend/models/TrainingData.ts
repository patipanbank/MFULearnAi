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
  modelName: {
    type: String,
    required: true,
    default: 'mfu-custom'
  },
  accessGroups: {
    type: [String],
    required: true,
    default: ['Students', 'Staffs']
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
  category: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model('TrainingData', trainingDataSchema); 