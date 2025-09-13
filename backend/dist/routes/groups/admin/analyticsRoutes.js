"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../../middleware/auth");
const router = (0, express_1.Router)();
router.get('/overview', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                totalUsers: 0,
                totalChats: 0,
                totalMessages: 0,
                activeAgents: 0
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get analytics overview'
        });
    }
});
router.get('/usage', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                dailyActive: 0,
                weeklyActive: 0,
                monthlyActive: 0
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get usage metrics'
        });
    }
});
exports.default = router;
//# sourceMappingURL=analyticsRoutes.js.map