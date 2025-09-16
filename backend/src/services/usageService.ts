import mongoose from 'mongoose';
import { User } from '../models/user';

// Define Usage Schema
const UsageSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  chatCount: { type: Number, default: 0 },
  dailyUsage: {
    date: { type: String, default: () => new Date().toISOString().split('T')[0] },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 }
  },
  lastUsed: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Performance indexes for usage analytics
UsageSchema.index({ userId: 1 }); // Primary lookup (also unique)
UsageSchema.index({ lastUsed: -1 }); // Recent activity queries
UsageSchema.index({ totalTokens: -1 }); // Heavy users queries
UsageSchema.index({ 'dailyUsage.date': -1 }); // Daily usage reports
UsageSchema.index({ createdAt: -1 }); // New users tracking
UsageSchema.index({ chatCount: -1 }); // Most active users by chat count

// Update the updatedAt field before saving
UsageSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

const UsageModel = mongoose.model('Usage', UsageSchema);

interface UsageStats {
  userId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  chatCount: number;
  dailyUsage: {
    date: string;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class UsageService {
  constructor() {
    console.log('✅ Usage service initialized');
  }

  public async checkQuotaAndUsage(userId: string, inputTokens: number, outputTokens: number): Promise<{ canUse: boolean; reason?: string; usage?: UsageStats }> {
    const user = await User.findById(userId);
    if (!user) {
      return { canUse: false, reason: 'User not found' };
    }

    const usage = await this.getUserUsage(userId);
    const totalNewTokens = inputTokens + outputTokens;
    const today = new Date().toISOString().split('T')[0];

    // Check if user exceeds total quota
    if (user.tokenQuota && usage && (usage.totalTokens + totalNewTokens) > user.tokenQuota) {
      return { canUse: false, reason: 'Token quota exceeded', usage };
    }

    // Check daily limit
    if (user.dailyTokenLimit && usage?.dailyUsage) {
      const dailyTotal = usage.dailyUsage.date === today 
        ? usage.dailyUsage.totalTokens + totalNewTokens
        : totalNewTokens;
      
      if (dailyTotal > user.dailyTokenLimit) {
        return { canUse: false, reason: 'Daily token limit exceeded', usage };
      }
    }

    return { canUse: true, usage: usage || undefined };
  }

  public async updateUsage(userId: string, inputTokens: number, outputTokens: number): Promise<{ success: boolean; reason?: string }> {
    const quotaCheck = await this.checkQuotaAndUsage(userId, inputTokens, outputTokens);
    
    if (!quotaCheck.canUse) {
      console.log(`⚠️ Usage blocked for user ${userId}: ${quotaCheck.reason}`);
      return { success: false, reason: quotaCheck.reason };
    }

    const totalTokens = inputTokens + outputTokens;
    const now = new Date();
    const today = new Date().toISOString().split('T')[0];

    await UsageModel.findOneAndUpdate(
      { userId },
      {
        $inc: {
          inputTokens,
          outputTokens,
          totalTokens,
          chatCount: 1,
          [`dailyUsage.inputTokens`]: inputTokens,
          [`dailyUsage.outputTokens`]: outputTokens,
          [`dailyUsage.totalTokens`]: totalTokens,
        },
        $set: {
          [`dailyUsage.date`]: today,
          lastUsed: now,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true, new: true }
    );

    // Reset daily usage if it's a new day
    const usage = await UsageModel.findOne({ userId });
    if (usage?.dailyUsage?.date !== today) {
      await UsageModel.findOneAndUpdate(
        { userId },
        {
          $set: {
            'dailyUsage.date': today,
            'dailyUsage.inputTokens': inputTokens,
            'dailyUsage.outputTokens': outputTokens,
            'dailyUsage.totalTokens': totalTokens
          }
        }
      );
    }

    console.log(`📊 Updated usage for user ${userId}: +${inputTokens} input, +${outputTokens} output tokens`);
    return { success: true };
  }

  public async getUserUsage(userId: string): Promise<UsageStats | null> {
    const usage = await UsageModel.findOne({ userId });
    return usage as UsageStats | null;
  }

  public async getTotalUsage(): Promise<{
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalChats: number;
    activeUsers: number;
  }> {
    const result = await UsageModel.aggregate([
      {
        $group: {
          _id: null,
          totalInputTokens: { $sum: '$inputTokens' },
          totalOutputTokens: { $sum: '$outputTokens' },
          totalTokens: { $sum: '$totalTokens' },
          totalChats: { $sum: '$chatCount' },
          activeUsers: { $sum: 1 }
        }
      }
    ]);

    if (result.length === 0) {
      return {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalChats: 0,
        activeUsers: 0
      };
    }

    return result[0];
  }

  public async resetUserUsage(userId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    await UsageModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          chatCount: 0,
          'dailyUsage.date': today,
          'dailyUsage.inputTokens': 0,
          'dailyUsage.outputTokens': 0,
          'dailyUsage.totalTokens': 0,
          updatedAt: new Date()
        }
      }
    );

    console.log(`🔄 Reset usage for user ${userId}`);
  }

  public async getUserQuotaInfo(userId: string): Promise<{
    user: { tokenQuota?: number; dailyTokenLimit?: number; } | null;
    usage: UsageStats | null;
    remainingQuota?: number;
    remainingDaily?: number;
  }> {
    const user = await User.findById(new mongoose.Types.ObjectId(userId)).select('tokenQuota dailyTokenLimit');
    console.log(`🔍 getUserQuotaInfo - userId: ${userId}, user found:`, !!user);
    const usage = await this.getUserUsage(userId);
    const today = new Date().toISOString().split('T')[0];

    const remainingQuota = user?.tokenQuota ? user.tokenQuota - (usage?.totalTokens || 0) : undefined;
    
    let remainingDaily: number | undefined = undefined;
    if (user?.dailyTokenLimit && usage?.dailyUsage) {
      const dailyUsed = usage.dailyUsage.date === today ? usage.dailyUsage.totalTokens : 0;
      remainingDaily = user.dailyTokenLimit - dailyUsed;
    } else if (user?.dailyTokenLimit) {
      remainingDaily = user.dailyTokenLimit;
    }

    return {
      user: user ? { tokenQuota: user.tokenQuota, dailyTokenLimit: user.dailyTokenLimit } : null,
      usage,
      remainingQuota,
      remainingDaily
    };
  }

  public async updateUserQuota(userId: string, tokenQuota?: number, dailyTokenLimit?: number): Promise<void> {
    const updateFields: any = {};
    if (tokenQuota !== undefined) updateFields.tokenQuota = tokenQuota;
    if (dailyTokenLimit !== undefined) updateFields.dailyTokenLimit = dailyTokenLimit;

    await User.findByIdAndUpdate(userId, { $set: updateFields });
    console.log(`📝 Updated quota for user ${userId}: ${JSON.stringify(updateFields)}`);
  }
}

export const usageService = new UsageService(); 