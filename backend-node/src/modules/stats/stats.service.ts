import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatDocument } from '../chat/chat.schema';
import { UserDocument } from '../users/user.schema';
import { ChatStatsDocument } from './chat-stats.schema';

@Injectable()
export class StatsService {
  constructor(
    @InjectModel('Chat') private readonly chatModel: Model<ChatDocument>,
    @InjectModel('User') private readonly userModel: Model<UserDocument>,
    @InjectModel('ChatStats') private readonly statsModel: Model<ChatStatsDocument>,
  ) {}

  async getTotalStats() {
    const totalUsers = await this.userModel.countDocuments();
    const totalChats = await this.chatModel.countDocuments();

    // Aggregate total tokens across ChatStats collection
    const agg = await this.statsModel.aggregate([
      {
        $group: {
          _id: null,
          tokens: { $sum: { $ifNull: ['$totalTokens', 0] } },
        },
      },
    ]);

    const totalTokens = agg.length ? agg[0].tokens : 0;
    return { totalUsers, totalChats, totalTokens };
  }

  async getDailyChatStats() {
    const now = new Date();
    // Asia/Bangkok offset = +7:00
    const startOfDay = new Date(now.getTime());
    startOfDay.setUTCHours(0 - 7, 0, 0, 0);
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const dailyChats = await this.chatModel.countDocuments({
      createdAt: { $gte: startOfDay, $lt: endOfDay },
    });

    return {
      date: now.toISOString().split('T')[0],
      totalChatsToday: dailyChats,
    };
  }

  async getDailyStats(startDate?: string, endDate?: string) {
    const query: any = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      // Include full end day
      end.setUTCHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }
    const stats = await this.statsModel.find(query).sort({ date: -1 }).lean();
    return stats.map((s: ChatStatsDocument) => ({
      date: s.date,
      uniqueUsers: s.uniqueUsers.length,
      totalChats: s.totalChats,
      totalTokens: s.totalTokens ?? 0,
    }));
  }
} 