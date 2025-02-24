import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
  data: { type: String, required: true },
  mediaType: { type: String, required: true }
}, { _id: false });

const sourceSchema = new mongoose.Schema({
  modelId: { type: String },
  collectionName: { type: String },
  filename: { type: String },
  similarity: { type: Number }
}, { _id: false });

const messageSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  role: { 
    type: String, 
    enum: ['user', 'assistant', 'system'], 
    required: true 
  },
  content: { 
    type: String, 
    required: function(this: { images?: { data: string; mediaType: string }[] }) {
      return !this.images || this.images.length === 0;
    }
  },
  timestamp: { 
    type: Date, 
    default: Date.now,
    required: true 
  },
  images: [imageSchema],
  sources: [sourceSchema],
  isImageGeneration: { 
    type: Boolean, 
    default: false 
  }
}, { _id: false });

const chatHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  modelId: { type: String, required: true },
  collectionName: { type: String },
  chatname: { 
    type: String, 
    required: true,
    maxLength: 100 
  },
  messages: [messageSchema],
  sources: [sourceSchema],
  isPinned: { type: Boolean, default: false },
  folder: { type: String, default: 'default' }
}, { 
  timestamps: true,
  index: [
    { userId: 1 },
    { userId: 1, updatedAt: -1 },
    { userId: 1, modelId: 1 }
  ]
});

// Add validation for messages array
chatHistorySchema.pre('save', function(next) {
  if (!this.messages || this.messages.length === 0) {
    next(new Error('Chat history must have at least one message'));
    return;
  }
  next();
});

export const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema); 