"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatStatsService = exports.ChatStatsService = void 0;
const ChatStats_1 = require("../../models/ChatStats");
const constants_1 = require("../../constants");
/**
 * Service for chat statistics management
 */
class ChatStatsService {
    /**
     * Get today's date in Thailand timezone (UTC+7)
     */
    getTodayInThailand() {
        const today = new Date();
        today.setTime(today.getTime() + constants_1.THAILAND_TIMEZONE_OFFSET_MS);
        today.setHours(0, 0, 0, 0);
        return today;
    }
    /**
     * Update daily chat statistics
     */
    async updateDailyStats(userId) {
        try {
            const today = this.getTodayInThailand();
            await ChatStats_1.ChatStats.findOneAndUpdate({ date: today }, {
                $addToSet: { uniqueUsers: userId },
                $inc: { totalChats: 1 },
            }, {
                upsert: true,
                new: true,
            });
        }
        catch (error) {
            console.error('Error updating daily stats:', error);
        }
    }
    /**
     * Update token usage in daily stats
     */
    async updateTokenUsage(tokens) {
        try {
            const today = this.getTodayInThailand();
            await ChatStats_1.ChatStats.findOneAndUpdate({ date: today }, { $inc: { totalTokens: tokens } }, { upsert: true });
        }
        catch (error) {
            console.error('Error updating token usage in stats:', error);
        }
    }
}
exports.ChatStatsService = ChatStatsService;
exports.chatStatsService = new ChatStatsService();
