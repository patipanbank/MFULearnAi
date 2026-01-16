"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailyStats = void 0;
const ChatStats_1 = require("../models/ChatStats");
const errorHandler_1 = require("../middleware/errorHandler");
// Helper to create typed async handler
const authHandler = (fn) => (0, errorHandler_1.asyncHandler)(fn);
/**
 * GET /api/stats/daily - Get daily chat statistics (SuperAdmin only)
 */
exports.getDailyStats = authHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const query = {};
    if (startDate && endDate) {
        // Convert dates to Thailand time
        const start = new Date(startDate);
        const end = new Date(endDate);
        // Adjust to UTC+7
        start.setHours(start.getHours() + 7);
        end.setHours(end.getHours() + 7);
        // Reset to start and end of day
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        query.date = {
            $gte: start,
            $lte: end,
        };
    }
    const stats = await ChatStats_1.ChatStats.find(query).sort({ date: -1 });
    const formattedStats = stats.map(stat => ({
        date: stat.date,
        uniqueUsers: stat.uniqueUsers.length,
        totalChats: stat.totalChats,
        totalTokens: stat.totalTokens || 0,
    }));
    res.json(formattedStats);
});
