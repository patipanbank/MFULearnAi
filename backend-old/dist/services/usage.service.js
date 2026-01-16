"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usageService = void 0;
const UserUsage_1 = require("../models/UserUsage");
const errors_1 = require("../errors");
class UsageService {
    constructor() {
        this.DAILY_TOKEN_LIMIT = 100000; // Daily token limit
    }
    /**
     * Check if user has remaining token quota
     */
    async checkUserLimit(userId) {
        try {
            let usage = await UserUsage_1.UserUsage.findOne({ userId });
            if (!usage) {
                usage = new UserUsage_1.UserUsage({
                    userId,
                    tokenLimit: this.DAILY_TOKEN_LIMIT,
                });
            }
            usage.checkAndResetDaily();
            return usage.dailyTokens < usage.tokenLimit;
        }
        catch (error) {
            console.error('Error checking user limit:', error);
            throw new errors_1.InternalError('Failed to check user limit');
        }
    }
    /**
     * Update token usage for user
     */
    async updateTokenUsage(userId, tokens) {
        try {
            let usage = await UserUsage_1.UserUsage.findOne({ userId });
            if (!usage) {
                usage = new UserUsage_1.UserUsage({
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
        }
        catch (error) {
            console.error('Error updating token usage:', error);
            throw new errors_1.InternalError('Failed to update token usage');
        }
    }
    /**
     * Get user usage information
     */
    async getUserUsage(userId) {
        try {
            let usage = await UserUsage_1.UserUsage.findOne({ userId });
            if (!usage) {
                usage = new UserUsage_1.UserUsage({
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
        }
        catch (error) {
            console.error('Error getting user usage:', error);
            throw new errors_1.InternalError('Failed to get user usage');
        }
    }
}
exports.usageService = new UsageService();
