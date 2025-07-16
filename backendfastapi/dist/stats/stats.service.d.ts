import { Model } from 'mongoose';
import { ChatDocument } from '../models/chat.model';
import { UserDocument } from '../models/user.model';
export interface DailyStat {
    date: string;
    uniqueUsers: number;
    totalChats: number;
    totalTokens: number;
}
export interface TotalStats {
    totalUsers: number;
    totalChats: number;
    totalMessages: number;
    totalTokens: number;
    activeUsers: number;
    averageChatsPerUser: number;
    averageMessagesPerChat: number;
}
export interface DailyChatStats {
    today: {
        chats: number;
        messages: number;
        users: number;
    };
    yesterday: {
        chats: number;
        messages: number;
        users: number;
    };
    thisWeek: {
        chats: number;
        messages: number;
        users: number;
    };
    thisMonth: {
        chats: number;
        messages: number;
        users: number;
    };
}
export declare class StatsService {
    private chatModel;
    private userModel;
    constructor(chatModel: Model<ChatDocument>, userModel: Model<UserDocument>);
    getDailyStats(startDate?: string, endDate?: string): Promise<DailyStat[]>;
    getTotalStats(): Promise<TotalStats>;
    getDailyChatStats(): Promise<DailyChatStats>;
    getUserStats(userId: string): Promise<any>;
    getSystemHealth(): Promise<any>;
    getAdvancedAnalytics(startDate?: string, endDate?: string): Promise<any>;
    private getTokenUsageAnalytics;
    private getModelUsageAnalytics;
    private getDepartmentAnalytics;
    private getPerformanceMetrics;
    private getUsageTrends;
}
