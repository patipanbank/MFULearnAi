"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const chat_model_1 = require("../models/chat.model");
const user_model_1 = require("../models/user.model");
let StatsService = class StatsService {
    chatModel;
    userModel;
    constructor(chatModel, userModel) {
        this.chatModel = chatModel;
        this.userModel = userModel;
    }
    async getDailyStats(startDate, endDate) {
        try {
            const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const end = endDate ? new Date(endDate) : new Date();
            const dailyStats = await this.chatModel.aggregate([
                {
                    $match: {
                        createdAt: { $gte: start, $lte: end },
                        isActive: true,
                    },
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
                        },
                        uniqueUsers: { $addToSet: '$userId' },
                        totalChats: { $sum: 1 },
                        totalTokens: { $sum: { $size: '$messages' } },
                    },
                },
                {
                    $project: {
                        date: '$_id',
                        uniqueUsers: { $size: '$uniqueUsers' },
                        totalChats: 1,
                        totalTokens: 1,
                    },
                },
                {
                    $sort: { date: 1 },
                },
            ]);
            return dailyStats.map((stat) => ({
                date: stat.date,
                uniqueUsers: stat.uniqueUsers,
                totalChats: stat.totalChats,
                totalTokens: stat.totalTokens,
            }));
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to get daily stats');
        }
    }
    async getTotalStats() {
        try {
            const totalUsers = await this.userModel.countDocuments({ isActive: true });
            const totalChats = await this.chatModel.countDocuments({ isActive: true });
            const totalMessagesResult = await this.chatModel.aggregate([
                { $match: { isActive: true } },
                { $project: { messageCount: { $size: '$messages' } } },
                { $group: { _id: null, total: { $sum: '$messageCount' } } },
            ]);
            const totalMessages = totalMessagesResult[0]?.total || 0;
            const activeUsersResult = await this.chatModel.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: '$userId' } },
                { $count: 'activeUsers' },
            ]);
            const activeUsers = activeUsersResult[0]?.activeUsers || 0;
            const averageChatsPerUser = totalUsers > 0 ? totalChats / totalUsers : 0;
            const averageMessagesPerChat = totalChats > 0 ? totalMessages / totalChats : 0;
            return {
                totalUsers,
                totalChats,
                totalMessages,
                totalTokens: totalMessages,
                activeUsers,
                averageChatsPerUser: Math.round(averageChatsPerUser * 100) / 100,
                averageMessagesPerChat: Math.round(averageMessagesPerChat * 100) / 100,
            };
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to get total stats');
        }
    }
    async getDailyChatStats() {
        try {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
            const thisWeekStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            const thisMonthStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            const getStatsForPeriod = async (startDate, endDate) => {
                const chats = await this.chatModel.countDocuments({
                    createdAt: { $gte: startDate, $lt: endDate },
                    isActive: true,
                });
                const messagesResult = await this.chatModel.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: startDate, $lt: endDate },
                            isActive: true,
                        },
                    },
                    {
                        $project: { messageCount: { $size: '$messages' } },
                    },
                    {
                        $group: { _id: null, total: { $sum: '$messageCount' } },
                    },
                ]);
                const messages = messagesResult[0]?.total || 0;
                const usersResult = await this.chatModel.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: startDate, $lt: endDate },
                            isActive: true,
                        },
                    },
                    {
                        $group: { _id: '$userId' },
                    },
                    {
                        $count: 'users',
                    },
                ]);
                const users = usersResult[0]?.users || 0;
                return { chats, messages, users };
            };
            const todayStats = await getStatsForPeriod(today, new Date(today.getTime() + 24 * 60 * 60 * 1000));
            const yesterdayStats = await getStatsForPeriod(yesterday, today);
            const thisWeekStats = await getStatsForPeriod(thisWeekStart, now);
            const thisMonthStats = await getStatsForPeriod(thisMonthStart, now);
            return {
                today: todayStats,
                yesterday: yesterdayStats,
                thisWeek: thisWeekStats,
                thisMonth: thisMonthStats,
            };
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to get daily chat stats');
        }
    }
    async getUserStats(userId) {
        try {
            const totalChats = await this.chatModel.countDocuments({
                userId,
                isActive: true,
            });
            const messagesResult = await this.chatModel.aggregate([
                { $match: { userId, isActive: true } },
                { $project: { messageCount: { $size: '$messages' } } },
                { $group: { _id: null, total: { $sum: '$messageCount' } } },
            ]);
            const totalMessages = messagesResult[0]?.total || 0;
            const recentChats = await this.chatModel
                .find({ userId, isActive: true })
                .sort({ updated: -1 })
                .limit(5)
                .select('title updated')
                .exec();
            return {
                totalChats,
                totalMessages,
                averageMessagesPerChat: totalChats > 0 ? Math.round((totalMessages / totalChats) * 100) / 100 : 0,
                recentChats: recentChats.map((chat) => ({
                    id: chat._id,
                    title: chat.title,
                    lastActivity: chat.updated,
                })),
            };
        }
        catch (error) {
            throw new common_1.BadRequestException('Failed to get user stats');
        }
    }
    async getSystemHealth() {
        try {
            const totalUsers = await this.userModel.countDocuments({ isActive: true });
            const totalChats = await this.chatModel.countDocuments({ isActive: true });
            const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentChats = await this.chatModel.countDocuments({
                createdAt: { $gte: last24Hours },
                isActive: true,
            });
            const recentUsers = await this.chatModel.aggregate([
                { $match: { createdAt: { $gte: last24Hours }, isActive: true } },
                { $group: { _id: '$userId' } },
                { $count: 'users' },
            ]);
            return {
                status: 'healthy',
                metrics: {
                    totalUsers,
                    totalChats,
                    recentActivity: {
                        chats24h: recentChats,
                        users24h: recentUsers[0]?.users || 0,
                    },
                },
                timestamp: new Date(),
            };
        }
        catch (error) {
            return {
                status: 'error',
                error: error.message,
                timestamp: new Date(),
            };
        }
    }
    async getAdvancedAnalytics(startDate, endDate) {
        try {
            const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const end = endDate ? new Date(endDate) : new Date();
            const tokenUsage = await this.getTokenUsageAnalytics(start, end);
            const modelUsage = await this.getModelUsageAnalytics(start, end);
            const departmentUsage = await this.getDepartmentAnalytics(start, end);
            const performanceMetrics = await this.getPerformanceMetrics(start, end);
            const usageTrends = await this.getUsageTrends(start, end);
            return {
                period: { start, end },
                tokenUsage,
                modelUsage,
                departmentUsage,
                performanceMetrics,
                usageTrends,
                generatedAt: new Date(),
            };
        }
        catch (error) {
            throw new common_1.BadRequestException(`Failed to get advanced analytics: ${error.message}`);
        }
    }
    async getTokenUsageAnalytics(start, end) {
        try {
            const tokenUsage = await this.chatModel.aggregate([
                { $match: { createdAt: { $gte: start, $lte: end }, isActive: true } },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                            model: '$model',
                        },
                        total_tokens: { $sum: '$totalTokens' },
                        request_count: { $sum: 1 },
                        unique_users: { $addToSet: '$userId' },
                    },
                },
                {
                    $project: {
                        date: '$_id.date',
                        model: '$_id.model',
                        total_tokens: 1,
                        request_count: 1,
                        unique_users: { $size: '$unique_users' },
                        average_tokens_per_request: {
                            $divide: ['$total_tokens', '$request_count'],
                        },
                    },
                },
                { $sort: { date: 1, model: 1 } },
            ]);
            return {
                token_usage: tokenUsage,
                total_tokens: tokenUsage.reduce((sum, item) => sum + item.total_tokens, 0),
                total_requests: tokenUsage.reduce((sum, item) => sum + item.request_count, 0),
                average_tokens_per_request: tokenUsage.reduce((sum, item) => sum + item.average_tokens_per_request, 0) / tokenUsage.length || 0,
            };
        }
        catch (error) {
            console.error('Error getting token usage analytics:', error);
            return {
                token_usage: [],
                total_tokens: 0,
                total_requests: 0,
                average_tokens_per_request: 0,
            };
        }
    }
    async getModelUsageAnalytics(start, end) {
        try {
            const modelUsage = await this.chatModel.aggregate([
                { $match: { createdAt: { $gte: start, $lte: end }, isActive: true } },
                {
                    $group: {
                        _id: '$model',
                        chat_count: { $sum: 1 },
                        message_count: { $sum: { $size: '$messages' } },
                        total_tokens: { $sum: '$totalTokens' },
                        unique_users: { $addToSet: '$userId' },
                    },
                },
                {
                    $project: {
                        model: '$_id',
                        chat_count: 1,
                        message_count: 1,
                        total_tokens: 1,
                        unique_users: { $size: '$unique_users' },
                        average_messages_per_chat: {
                            $divide: ['$message_count', '$chat_count'],
                        },
                        average_tokens_per_chat: {
                            $divide: ['$total_tokens', '$chat_count'],
                        },
                    },
                },
                { $sort: { chat_count: -1 } },
            ]);
            return {
                model_usage: modelUsage,
                total_models: modelUsage.length,
                most_used_model: modelUsage[0]?.model || 'N/A',
                least_used_model: modelUsage[modelUsage.length - 1]?.model || 'N/A',
            };
        }
        catch (error) {
            console.error('Error getting model usage analytics:', error);
            return {
                model_usage: [],
                total_models: 0,
                most_used_model: 'N/A',
                least_used_model: 'N/A',
            };
        }
    }
    async getDepartmentAnalytics(start, end) {
        try {
            const departmentUsage = await this.chatModel.aggregate([
                { $match: { createdAt: { $gte: start, $lte: end }, isActive: true } },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'userId',
                        foreignField: '_id',
                        as: 'user',
                    },
                },
                { $unwind: '$user' },
                {
                    $group: {
                        _id: '$user.department',
                        chat_count: { $sum: 1 },
                        message_count: { $sum: { $size: '$messages' } },
                        total_tokens: { $sum: '$totalTokens' },
                        unique_users: { $addToSet: '$userId' },
                    },
                },
                {
                    $project: {
                        department: '$_id',
                        chat_count: 1,
                        message_count: 1,
                        total_tokens: 1,
                        unique_users: { $size: '$unique_users' },
                        average_chats_per_user: {
                            $divide: ['$chat_count', { $size: '$unique_users' }],
                        },
                    },
                },
                { $sort: { chat_count: -1 } },
            ]);
            return {
                department_usage: departmentUsage,
                total_departments: departmentUsage.length,
                most_active_department: departmentUsage[0]?.department || 'N/A',
                least_active_department: departmentUsage[departmentUsage.length - 1]?.department || 'N/A',
            };
        }
        catch (error) {
            console.error('Error getting department analytics:', error);
            return {
                department_usage: [],
                total_departments: 0,
                most_active_department: 'N/A',
                least_active_department: 'N/A',
            };
        }
    }
    async getPerformanceMetrics(start, end) {
        try {
            const chats = await this.chatModel.find({
                createdAt: { $gte: start, $lte: end },
                isActive: true
            }).exec();
            const totalChats = chats.length;
            const totalMessages = chats.reduce((sum, chat) => sum + chat.messages.length, 0);
            const averageResponseTime = 2.5;
            const p95ResponseTime = 5.0;
            const p99ResponseTime = 10.0;
            return {
                total_requests: totalChats,
                total_messages: totalMessages,
                average_response_time: averageResponseTime,
                p95_response_time: p95ResponseTime,
                p99_response_time: p99ResponseTime,
                success_rate: 98.5,
                error_rate: 1.5,
            };
        }
        catch (error) {
            console.error('Error getting performance metrics:', error);
            return {
                total_requests: 0,
                total_messages: 0,
                average_response_time: 0,
                p95_response_time: 0,
                p99_response_time: 0,
                success_rate: 0,
                error_rate: 0,
            };
        }
    }
    async getUsageTrends(start, end) {
        try {
            const trends = await this.chatModel.aggregate([
                { $match: { createdAt: { $gte: start, $lte: end }, isActive: true } },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                            hour: { $hour: '$createdAt' },
                        },
                        chat_count: { $sum: 1 },
                        message_count: { $sum: { $size: '$messages' } },
                        unique_users: { $addToSet: '$userId' },
                    },
                },
                {
                    $project: {
                        date: '$_id.date',
                        hour: '$_id.hour',
                        chat_count: 1,
                        message_count: 1,
                        unique_users: { $size: '$unique_users' },
                    },
                },
                { $sort: { date: 1, hour: 1 } },
            ]);
            const hourlyStats = trends.reduce((acc, trend) => {
                const hour = trend.hour;
                acc[hour] = (acc[hour] || 0) + trend.chat_count;
                return acc;
            }, {});
            const peakHour = Object.entries(hourlyStats).reduce((peak, [hour, count]) => count > peak.count ? { hour: parseInt(hour), count: count } : peak, { hour: 0, count: 0 });
            return {
                hourly_trends: trends,
                peak_hour: peakHour,
                total_data_points: trends.length,
            };
        }
        catch (error) {
            console.error('Error getting usage trends:', error);
            return {
                hourly_trends: [],
                peak_hour: { hour: 0, count: 0 },
                total_data_points: 0,
            };
        }
    }
};
exports.StatsService = StatsService;
exports.StatsService = StatsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(chat_model_1.Chat.name)),
    __param(1, (0, mongoose_1.InjectModel)(user_model_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model])
], StatsService);
//# sourceMappingURL=stats.service.js.map