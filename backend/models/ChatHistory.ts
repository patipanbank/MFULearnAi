import mongoose from 'mongoose';

const chatHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  chatname: { type: String, required: true },
  messages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true }
  }]
}, { 
  timestamps: true,
  index: [
    { userId: 1 }
  ]
});

export const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema); 