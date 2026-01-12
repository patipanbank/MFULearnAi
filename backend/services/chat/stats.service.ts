import { ChatStats } from '../../models/ChatStats';
import { THAILAND_TIMEZONE_OFFSET_MS } from '../../constants';

/**
 * Service for chat statistics management
 */
export class ChatStatsService {
  /**
   * Get today's date in Thailand timezone (UTC+7)
   */
  private getTodayInThailand(): Date {
    const today = new Date();
    today.setTime(today.getTime() + THAILAND_TIMEZONE_OFFSET_MS);
    today.setHours(0, 0, 0, 0);
    return today;
  }

  /**
   * Update daily chat statistics
   */
  async updateDailyStats(userId: string): Promise<void> {
    try {
      const today = this.getTodayInThailand();

      await ChatStats.findOneAndUpdate(
        { date: today },
        {
          $addToSet: { uniqueUsers: userId },
          $inc: { totalChats: 1 },
        },
        {
          upsert: true,
          new: true,
        }
      );
    } catch (error) {
      console.error('Error updating daily stats:', error);
    }
  }

  /**
   * Update token usage in daily stats
   */
  async updateTokenUsage(tokens: number): Promise<void> {
    try {
      const today = this.getTodayInThailand();

      await ChatStats.findOneAndUpdate(
        { date: today },
        { $inc: { totalTokens: tokens } },
        { upsert: true }
      );
    } catch (error) {
      console.error('Error updating token usage in stats:', error);
    }
  }
}

export const chatStatsService = new ChatStatsService();
