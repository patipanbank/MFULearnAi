import { Model } from 'mongoose';
import { ChatDocument } from '../chat/chat.schema';
import { UserDocument } from '../users/user.schema';
import { ChatStatsDocument } from './chat-stats.schema';
export declare class StatsService {
    private readonly chatModel;
    private readonly userModel;
    private readonly statsModel;
    constructor(chatModel: Model<ChatDocument>, userModel: Model<UserDocument>, statsModel: Model<ChatStatsDocument>);
    getTotalStats(): Promise<{
        totalUsers: number;
        totalChats: number;
        totalTokens: any;
    }>;
    getDailyChatStats(): Promise<{
        date: string;
        totalChatsToday: number;
    }>;
    getDailyStats(startDate?: string, endDate?: string): Promise<{
        date: Date;
        uniqueUsers: number;
        totalChats: number;
        totalTokens: number;
    }[]>;
}
