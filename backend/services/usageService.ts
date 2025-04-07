import { UserUsage } from '../models/UserUsage';

class UsageService {
  private readonly DAILY_TOKEN_LIMIT = 100000; // จำกัด token ต่อวัน

  async checkUserLimit(userId: string): Promise<boolean> {
    let usage = await UserUsage.findOne({ userId });
    
    if (!usage) {
      usage = new UserUsage({ 
        userId,
        tokenLimit: this.DAILY_TOKEN_LIMIT 
      });
    }

    usage.checkAndResetDaily();
    
    return usage.dailyTokens < usage.tokenLimit;
  }

  /**
   * Record token usage with separate tracking of input and output tokens
   * @param userId User ID to record usage for
   * @param inputTokens Estimated input tokens used
   * @param outputTokens Output tokens used
   * @returns Updated usage information
   */
  async recordUsage(userId: string, inputTokens: number, outputTokens: number): Promise<{
    dailyTokens: number;
    tokenLimit: number;
    remainingTokens: number;
  }> {
    // Calculate total tokens used in this operation
    const totalTokens = inputTokens + outputTokens;
    
    // Use existing method to update the usage
    return this.updateTokenUsage(userId, totalTokens);
  }

  async updateTokenUsage(userId: string, tokens: number): Promise<{ 
    dailyTokens: number; 
    tokenLimit: number;
    remainingTokens: number;
  }> {
    let usage = await UserUsage.findOne({ userId });
    
    if (!usage) {
      usage = new UserUsage({ 
        userId,
        tokenLimit: this.DAILY_TOKEN_LIMIT 
      });
    }

    usage.checkAndResetDaily();
    usage.dailyTokens += tokens;
    await usage.save();

    console.log(`[Usage] Updated token usage for ${userId}:`, {
      added: tokens,
      daily: usage.dailyTokens,
      limit: usage.tokenLimit,
      remaining: Math.max(0, usage.tokenLimit - usage.dailyTokens)
    });

    return {
      dailyTokens: usage.dailyTokens,
      tokenLimit: usage.tokenLimit,
      remainingTokens: Math.max(0, usage.tokenLimit - usage.dailyTokens)
    };
  }

  async getUserUsage(userId: string) {
    let usage = await UserUsage.findOne({ userId });
    
    if (!usage) {
      usage = new UserUsage({ 
        userId,
        tokenLimit: this.DAILY_TOKEN_LIMIT 
      });
      await usage.save();
    }

    usage.checkAndResetDaily();
    
    return {
      dailyTokens: usage.dailyTokens,
      tokenLimit: usage.tokenLimit,
      remainingTokens: Math.max(0, usage.tokenLimit - usage.dailyTokens),
      resetTime: usage.lastReset
    };
  }
}

export const usageService = new UsageService();