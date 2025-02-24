import mongoose from 'mongoose';

interface ChatMessage {
  role: string;
  content: string;
  timestamp?: Date;
  images?: Array<{
    data: string;
    mediaType: string;
  }>;
  sources?: Array<{
    modelId: string;
    collectionName: string;
    filename: string;
    similarity: number;
  }>;
  isImageGeneration?: boolean;
  isComplete?: boolean;
}

const chatSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  messages: {
    type: [{
      role: String,
      content: String,
      timestamp: { type: Date, default: Date.now },
      images: [{
        data: String,
        mediaType: String
      }],
      sources: [{
        modelId: String,
        collectionName: String,
        filename: String,
        similarity: Number
      }],
      isImageGeneration: Boolean,
      isComplete: Boolean
    }],
    required: true,
    validate: {
      validator: function(messages: ChatMessage[]) {
        return messages.length > 0;
      },
      message: 'Messages array cannot be empty'
    }
  },
  modelId: {
    type: String,
    required: true,
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  }
});

chatSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

export const Chat = mongoose.model('Chat', chatSchema); 