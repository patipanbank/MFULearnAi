import mongoose from 'mongoose';

// Define Usage Schema
const UsageSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  chatCount: { type: Number, default: 0 },
  lastUsed: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const UsageModel = mongoose.model('Usage', UsageSchema);

interface UsageStats {
  userId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  chatCount: number;
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class UsageService {
  constructor() {
    console.log('✅ Usage service initialized');
  }

  public async updateUsage(userId: string, inputTokens: number, outputTokens: number): Promise<void> {
    const totalTokens = inputTokens + outputTokens;
    const now = new Date();

    await UsageModel.findOneAndUpdate(
      { userId },
      {
        $inc: {
          inputTokens,
          outputTokens,
          totalTokens,
          chatCount: 1
        },
        $set: {
          lastUsed: now,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      { upsert: true, new: true }
    );

    console.log(`📊 Updated usage for user ${userId}: +${inputTokens} input, +${outputTokens} output tokens`);
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
    await UsageModel.findOneAndUpdate(
      { userId },
      {
        $set: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          chatCount: 0,
          updatedAt: new Date()
        }
      }
    );

    console.log(`🔄 Reset usage for user ${userId}`);
  }
}

export const usageService = new UsageService(); 