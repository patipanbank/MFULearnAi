"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const roleGuard_1 = require("../middleware/roleGuard");
const ChatStats_1 = require("../models/ChatStats");
const router = (0, express_1.Router)();
// ดึงสถิติรายวัน
router.get('/daily', (0, roleGuard_1.roleGuard)(['SuperAdmin']), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const query = {};
        if (startDate && endDate) {
            // แปลงวันที่เป็นเวลาไทย
            const start = new Date(startDate);
            const end = new Date(endDate);
            // ปรับเวลาเป็น UTC+7
            start.setHours(start.getHours() + 7);
            end.setHours(end.getHours() + 7);
            // รีเซ็ตเวลาเป็นต้นวันและสิ้นวัน
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            query.date = {
                $gte: start,
                $lte: end
            };
        }
        const stats = await ChatStats_1.ChatStats.find(query).sort({ date: -1 });
        const formattedStats = stats.map(stat => ({
            date: stat.date,
            uniqueUsers: stat.uniqueUsers.length,
            totalChats: stat.totalChats,
            totalTokens: stat.totalTokens || 0
        }));
        res.json(formattedStats);
    }
    catch (error) {
        console.error('Error fetching chat stats:', error);
        res.status(500).json({ error: 'Failed to fetch chat statistics' });
    }
});
exports.default = router;
