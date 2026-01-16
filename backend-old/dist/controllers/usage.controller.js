"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserUsage = void 0;
const usage_service_1 = require("../services/usage.service");
const errorHandler_1 = require("../middleware/errorHandler");
const errors_1 = require("../errors");
// Helper to create typed async handler
const authHandler = (fn) => (0, errorHandler_1.asyncHandler)(fn);
/**
 * GET /api/usage - Get current user's token usage
 */
exports.getUserUsage = authHandler(async (req, res) => {
    const user = req.user;
    const userId = user.nameID || user.username;
    if (!userId) {
        throw new errors_1.BadRequestError('User identifier not found');
    }
    const usage = await usage_service_1.usageService.getUserUsage(userId);
    // Calculate reset time (next day at 23:59 Thailand time)
    const now = new Date();
    const thaiTimeOffsetMs = 7 * 60 * 60 * 1000;
    const nowThai = new Date(now.getTime() + thaiTimeOffsetMs);
    const resetTime = new Date(nowThai);
    resetTime.setHours(23, 59, 0, 0);
    if (resetTime <= nowThai) {
        resetTime.setDate(resetTime.getDate() + 1);
    }
    const resetTimeUTC = new Date(resetTime.getTime() - thaiTimeOffsetMs);
    res.json({
        ...usage,
        resetTime: resetTimeUTC.toISOString(),
        percentUsed: Math.round((usage.dailyTokens / usage.tokenLimit) * 100),
    });
});
