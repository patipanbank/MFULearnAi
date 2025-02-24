import mongoose from 'mongoose';

const chatHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  modelId: { type: String, required: true },
  collectionName: { type: String, required: true },
  chatname: { type: String, required: true },
  isPinned: { type: Boolean, default: false },
  messages: [{
    id: { type: Number, required: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    images: [{
      data: String,
      mediaType: String
    }],
    sources: [{
      modelId: String,
      collectionName: String,
      filename: String,
      similarity: Number
    }]
  }],
  sources: [{
    modelId: { type: String },
    collectionName: { type: String },
    documents: [{
      filename: { type: String },
      similarity: { type: Number }
    }]
  }]
}, { timestamps: true });

export const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema); 