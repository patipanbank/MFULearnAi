import mongoose from 'mongoose';

const userUsageSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true,
    index: true 
  },
  monthYear: { 
    type: String, 
    required: true // เก็บในรูปแบบ "YYYY-MM"
  },
  questionCount: { 
    type: Number, 
    default: 0 
  },
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Compound index for faster queries
userUsageSchema.index({ userId: 1, monthYear: 1 }, { unique: true });

export const UserUsage = mongoose.model('UserUsage', userUsageSchema); 