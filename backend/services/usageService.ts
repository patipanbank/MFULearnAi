import { UserUsage } from '../models/UserUsage';

class UsageService {
  private readonly DAILY_LIMIT = 20; // จำนวนคำถามต่อวันที่อนุญาต

  async checkUserLimit(userId: string): Promise<boolean> {
    let usage = await UserUsage.findOne({ userId });
    
    if (!usage) {
      usage = new UserUsage({ userId });
    }

    usage.checkAndResetDaily();
    
    return usage.dailyTokens < usage.tokenLimit;
  }

  async updateTokenUsage(userId: string, tokens: number): Promise<void> {
    const usage = await UserUsage.findOne({ userId });
    if (usage) {
      usage.dailyTokens += tokens;
      await usage.save();
    }
  }

  async getUserUsage(userId: string) {
    let usage = await UserUsage.findOne({ userId });
    
    if (!usage) {
      usage = new UserUsage({ userId });
      await usage.save();
    }

    usage.checkAndResetDaily();
    
    return {
      dailyTokens: usage.dailyTokens,
      tokenLimit: usage.tokenLimit,
      remainingTokens: Math.max(0, usage.tokenLimit - usage.dailyTokens)
    };
  }
}

export const usageService = new UsageService();