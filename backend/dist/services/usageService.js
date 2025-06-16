"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usageService = void 0;
const UserUsage_1 = require("../models/UserUsage");
class UsageService {
    constructor() {
        this.DAILY_TOKEN_LIMIT = 100000; // จำกัด token ต่อวัน
    }
    async checkUserLimit(userId) {
        let usage = await UserUsage_1.UserUsage.findOne({ userId });
        if (!usage) {
            usage = new UserUsage_1.UserUsage({
                userId,
                tokenLimit: this.DAILY_TOKEN_LIMIT
            });
        }
        usage.checkAndResetDaily();
        return usage.dailyTokens < usage.tokenLimit;
    }
    async updateTokenUsage(userId, tokens) {
        let usage = await UserUsage_1.UserUsage.findOne({ userId });
        if (!usage) {
            usage = new UserUsage_1.UserUsage({
                userId,
                tokenLimit: this.DAILY_TOKEN_LIMIT
            });
        }
        usage.checkAndResetDaily();
        usage.dailyTokens += tokens;
        await usage.save();
        console.log(`[Usage] Updated token usage for ${userId}:`, {
            added: tokens,
            daily: usage.dailyTokens,
            limit: usage.tokenLimit,
            remaining: Math.max(0, usage.tokenLimit - usage.dailyTokens)
        });
        return {
            dailyTokens: usage.dailyTokens,
            tokenLimit: usage.tokenLimit,
            remainingTokens: Math.max(0, usage.tokenLimit - usage.dailyTokens)
        };
    }
    async getUserUsage(userId) {
        let usage = await UserUsage_1.UserUsage.findOne({ userId });
        if (!usage) {
            usage = new UserUsage_1.UserUsage({
                userId,
                tokenLimit: this.DAILY_TOKEN_LIMIT
            });
            await usage.save();
        }
        usage.checkAndResetDaily();
        return {
            dailyTokens: usage.dailyTokens,
            tokenLimit: usage.tokenLimit,
            remainingTokens: Math.max(0, usage.tokenLimit - usage.dailyTokens),
            resetTime: usage.lastReset
        };
    }
}
exports.usageService = new UsageService();
