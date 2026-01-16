import { UserUsage } from '../models/UserUsage';
import { InternalError } from '../errors';

class UsageService {
  private readonly DAILY_TOKEN_LIMIT = 100000; // Daily token limit

  /**
   * Check if user has remaining token quota
   */
  async checkUserLimit(userId: string): Promise<boolean> {
    try {
      let usage = await UserUsage.findOne({ userId });

      if (!usage) {
        usage = new UserUsage({
          userId,
          tokenLimit: this.DAILY_TOKEN_LIMIT,
        });
      }

      usage.checkAndResetDaily();

      return usage.dailyTokens < usage.tokenLimit;
    } catch (error) {
      console.error('Error checking user limit:', error);
      throw new InternalError('Failed to check user limit');
    }
  }

  /**
   * Update token usage for user
   */
  async updateTokenUsage(
    userId: string,
    tokens: number
  ): Promise<{
    dailyTokens: number;
    tokenLimit: number;
    remainingTokens: number;
  }> {
    try {
      let usage = await UserUsage.findOne({ userId });

      if (!usage) {
        usage = new UserUsage({
          userId,
          tokenLimit: this.DAILY_TOKEN_LIMIT,
        });
      }

      usage.checkAndResetDaily();
      usage.dailyTokens += tokens;
      await usage.save();

      console.log(`[Usage] Updated token usage for ${userId}:`, {
        added: tokens,
        daily: usage.dailyTokens,
        limit: usage.tokenLimit,
        remaining: Math.max(0, usage.tokenLimit - usage.dailyTokens),
      });

      return {
        dailyTokens: usage.dailyTokens,
        tokenLimit: usage.tokenLimit,
        remainingTokens: Math.max(0, usage.tokenLimit - usage.dailyTokens),
      };
    } catch (error) {
      console.error('Error updating token usage:', error);
      throw new InternalError('Failed to update token usage');
    }
  }

  /**
   * Get user usage information
   */
  async getUserUsage(userId: string): Promise<{
    dailyTokens: number;
    tokenLimit: number;
    remainingTokens: number;
  }> {
    try {
      let usage = await UserUsage.findOne({ userId });

      if (!usage) {
        usage = new UserUsage({
          userId,
          tokenLimit: this.DAILY_TOKEN_LIMIT,
        });
        await usage.save();
      }

      usage.checkAndResetDaily();
      await usage.save();

      return {
        dailyTokens: usage.dailyTokens,
        tokenLimit: usage.tokenLimit,
        remainingTokens: Math.max(0, usage.tokenLimit - usage.dailyTokens),
      };
    } catch (error) {
      console.error('Error getting user usage:', error);
      throw new InternalError('Failed to get user usage');
    }
  }
}

export const usageService = new UsageService();
