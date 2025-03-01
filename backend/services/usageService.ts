import { UserUsage } from '../models/UserUsage';

class UsageService {
  private readonly DAILY_LIMIT = 10; // จำนวนคำถามต่อวันที่อนุญาต

  async checkUserLimit(userId: string): Promise<boolean> {
    try {
      let usage = await UserUsage.findOne({ userId });
      
      if (!usage) {
        usage = new UserUsage({ userId });
      }

      usage.checkAndResetDaily();

      if (usage.dailyQuestions >= this.DAILY_LIMIT) {
        return false;
      }

      usage.dailyQuestions += 1;
      await usage.save();
      return true;
    } catch (error) {
      console.error('Error checking user limit:', error);
      return false;
    }
  }

  async getUserUsage(userId: string): Promise<{
    dailyQuestions: number;
    dailyLimit: number;
    remainingQuestions: number;
  }> {
    let usage = await UserUsage.findOne({ userId });
    
    if (!usage) {
      usage = new UserUsage({ userId });
      await usage.save();
    }

    usage.checkAndResetDaily();
    
    return {
      dailyQuestions: usage.dailyQuestions,
      dailyLimit: this.DAILY_LIMIT,
      remainingQuestions: Math.max(0, this.DAILY_LIMIT - usage.dailyQuestions)
    };
  }
}

export const usageService = new UsageService();