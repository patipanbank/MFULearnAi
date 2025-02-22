import mongoose from 'mongoose';

const chatHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  modelId: { type: String, required: true },
  collectionName: { type: String, required: false },
  chatname: { type: String, required: true },
  folder: { type: String, default: 'default' },
  tags: [{ type: String }],
  isPinned: { type: Boolean, default: false },
  lastAccessedAt: { type: Date, default: Date.now },
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
}, { 
  timestamps: true,
  index: [
    { userId: 1, updatedAt: -1 },
    { userId: 1, chatname: 'text' },
    { userId: 1, tags: 1 },
    { userId: 1, folder: 1 }
  ]
});

export const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema); 