"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const analyticsService_1 = require("../services/analyticsService");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
        return res.status(403).json({
            success: false,
            error: 'Access denied. Admin privileges required.'
        });
    }
    next();
};
router.get('/overview', auth_1.authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '24h';
        const analytics = await analyticsService_1.analyticsService.getAnalytics(timeRange);
        if (!analytics) {
            return res.status(500).json({
                success: false,
                error: 'Failed to retrieve analytics data'
            });
        }
        return res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('❌ Error getting analytics overview:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get analytics overview'
        });
    }
});
router.get('/performance', auth_1.authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const metrics = await analyticsService_1.analyticsService.getPerformanceMetrics();
        if (!metrics) {
            return res.status(500).json({
                success: false,
                error: 'Failed to retrieve performance metrics'
            });
        }
        return res.json({
            success: true,
            data: metrics
        });
    }
    catch (error) {
        console.error('❌ Error getting performance metrics:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get performance metrics'
        });
    }
});
router.get('/user-activity', auth_1.authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '24h';
        const analytics = await analyticsService_1.analyticsService.getAnalytics(timeRange);
        if (!analytics) {
            return res.status(500).json({
                success: false,
                error: 'Failed to retrieve user activity data'
            });
        }
        return res.json({
            success: true,
            data: {
                totalEvents: analytics.events.userActivity,
                recentEvents: analytics.recentEvents.userActivity,
                activeUsers: analytics.stats.activeUsers
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting user activity:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get user activity'
        });
    }
});
router.get('/agent-usage', auth_1.authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '24h';
        const analytics = await analyticsService_1.analyticsService.getAnalytics(timeRange);
        if (!analytics) {
            return res.status(500).json({
                success: false,
                error: 'Failed to retrieve agent usage data'
            });
        }
        return res.json({
            success: true,
            data: {
                totalUsage: analytics.events.agentUsage,
                agentStats: analytics.stats.agentStats,
                recentUsage: analytics.recentEvents.agentUsage
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting agent usage:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get agent usage'
        });
    }
});
router.get('/tool-usage', auth_1.authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '24h';
        const analytics = await analyticsService_1.analyticsService.getAnalytics(timeRange);
        if (!analytics) {
            return res.status(500).json({
                success: false,
                error: 'Failed to retrieve tool usage data'
            });
        }
        return res.json({
            success: true,
            data: {
                totalUsage: analytics.events.toolUsage,
                toolStats: analytics.stats.toolStats,
                recentUsage: analytics.recentEvents.toolUsage
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting tool usage:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get tool usage'
        });
    }
});
router.get('/chat-events', auth_1.authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '24h';
        const analytics = await analyticsService_1.analyticsService.getAnalytics(timeRange);
        if (!analytics) {
            return res.status(500).json({
                success: false,
                error: 'Failed to retrieve chat events data'
            });
        }
        return res.json({
            success: true,
            data: {
                totalEvents: analytics.events.chatEvents,
                recentEvents: analytics.recentEvents.chatEvents
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting chat events:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get chat events'
        });
    }
});
router.post('/cleanup', auth_1.authenticateJWT, requireAdmin, async (req, res) => {
    try {
        await analyticsService_1.analyticsService.cleanupOldData();
        return res.json({
            success: true,
            message: 'Analytics data cleanup completed successfully'
        });
    }
    catch (error) {
        console.error('❌ Error cleaning up analytics data:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to cleanup analytics data'
        });
    }
});
router.get('/export', auth_1.authenticateJWT, requireAdmin, async (req, res) => {
    try {
        const timeRange = req.query.timeRange || '24h';
        const analytics = await analyticsService_1.analyticsService.getAnalytics(timeRange);
        if (!analytics) {
            return res.status(500).json({
                success: false,
                error: 'Failed to export analytics data'
            });
        }
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`);
        const csvData = convertToCSV(analytics);
        return res.send(csvData);
    }
    catch (error) {
        console.error('❌ Error exporting analytics:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to export analytics data'
        });
    }
});
function convertToCSV(analytics) {
    const headers = ['Type', 'Count', 'Timestamp'];
    const rows = [];
    Object.entries(analytics.events).forEach(([type, count]) => {
        rows.push([type, count, new Date().toISOString()]);
    });
    Object.entries(analytics.stats.agentStats).forEach(([agentId, count]) => {
        rows.push([`agent_${agentId}`, count, new Date().toISOString()]);
    });
    Object.entries(analytics.stats.toolStats).forEach(([toolName, count]) => {
        rows.push([`tool_${toolName}`, count, new Date().toISOString()]);
    });
    const csvContent = [headers, ...rows]
        .map(row => row.map((cell) => `"${cell}"`).join(','))
        .join('\n');
    return csvContent;
}
exports.default = router;
//# sourceMappingURL=analytics.js.map