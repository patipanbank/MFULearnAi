import mongoose from 'mongoose';

const aiModelSchema = new mongoose.Schema({
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
  modelType: {
    type: String,
    required: true,
    enum: ['llama2', 'mistral', 'gemma']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('AIModel', aiModelSchema); 