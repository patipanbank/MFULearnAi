"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../../middleware/auth");
const router = (0, express_1.Router)();
router.get('/health', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'System health check failed'
        });
    }
});
router.get('/stats', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                nodeVersion: process.version
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get system stats'
        });
    }
});
exports.default = router;
//# sourceMappingURL=systemRoutes.js.map