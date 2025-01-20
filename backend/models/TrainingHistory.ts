import mongoose from 'mongoose';

const TrainingHistorySchema = new mongoose.Schema({
  text: String,
  trainedBy: String,
  trainedAt: Date,
  modelName: String,
  status: String,
  baseModel: {
    type: String,
    default: 'llama2'
  }
}, {
  timestamps: true
});

export default mongoose.model('TrainingHistory', TrainingHistorySchema); 