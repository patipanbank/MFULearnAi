import { UserUsage } from '../models/UserUsage';

class UsageService {
  private readonly DAILY_TOKEN_LIMIT = 100000; // กำหนด limit token ต่อวัน (ปรับตามความเหมาะสม)

  async checkUserLimit(userId: string): Promise<boolean> {
    let userUsage = await UserUsage.findOne({ userId });
    
    if (!userUsage) {
      userUsage = new UserUsage({ userId });
    }

    await userUsage.checkAndResetDaily();
    return userUsage.dailyTokens < this.DAILY_TOKEN_LIMIT;
  }

  async updateTokenUsage(userId: string, tokens: number): Promise<void> {
    let userUsage = await UserUsage.findOne({ userId });
    
    if (!userUsage) {
      userUsage = new UserUsage({ userId });
    }

    userUsage.dailyTokens += tokens;
    await userUsage.save();
  }

  async getUserUsage(userId: string): Promise<{ dailyTokens: number; limit: number }> {
    let userUsage = await UserUsage.findOne({ userId });
    
    if (!userUsage) {
      userUsage = new UserUsage({ userId });
      await userUsage.save();
    }

    await userUsage.checkAndResetDaily();
    
    return {
      dailyTokens: userUsage.dailyTokens,
      limit: this.DAILY_TOKEN_LIMIT
    };
  }
}

export const usageService = new UsageService();