import mongoose, { Document } from 'mongoose';

interface IUserUsage extends Document {
  userId: string;
  dailyQuestions: number;
  lastReset: Date;
  checkAndResetDaily(): number;
}

const userUsageSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  },
  dailyQuestions: {
    type: Number,
    default: 0
  },
  lastReset: {
    type: Date,
    default: Date.now
  }
});

// Reset daily questions if last reset was yesterday
userUsageSchema.methods.checkAndResetDaily = function() {
  const today = new Date();
  const lastReset = new Date(this.lastReset);
  
  if (today.getDate() !== lastReset.getDate() || 
      today.getMonth() !== lastReset.getMonth() ||
      today.getFullYear() !== lastReset.getFullYear()) {
    this.dailyQuestions = 0;
    this.lastReset = today;
  }
  return this.dailyQuestions;
};

export const UserUsage = mongoose.model<IUserUsage>('UserUsage', userUsageSchema);