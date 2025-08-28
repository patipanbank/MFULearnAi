"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const usageService_1 = require("../services/usageService");
const auth_1 = require("../middleware/auth");
const adminMiddleware_1 = require("../middleware/adminMiddleware");
const router = express_1.default.Router();
router.get('/me', auth_1.authenticateJWT, async (req, res) => {
    try {
        if (!req.user?.sub) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const quotaInfo = await usageService_1.usageService.getUserQuotaInfo(req.user.sub);
        console.log(`📊 Usage API response for user ${req.user.sub}:`, JSON.stringify(quotaInfo, null, 2));
        return res.json(quotaInfo);
    }
    catch (error) {
        console.error('Error fetching user usage:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/user/:userId', auth_1.authenticateJWT, adminMiddleware_1.adminMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const quotaInfo = await usageService_1.usageService.getUserQuotaInfo(userId);
        res.json(quotaInfo);
    }
    catch (error) {
        console.error('Error fetching user usage:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/system', auth_1.authenticateJWT, adminMiddleware_1.adminMiddleware, async (req, res) => {
    try {
        const totalUsage = await usageService_1.usageService.getTotalUsage();
        res.json(totalUsage);
    }
    catch (error) {
        console.error('Error fetching system usage:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/user/:userId/quota', auth_1.authenticateJWT, adminMiddleware_1.adminMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        const { tokenQuota, dailyTokenLimit } = req.body;
        await usageService_1.usageService.updateUserQuota(userId, tokenQuota, dailyTokenLimit);
        const updatedQuotaInfo = await usageService_1.usageService.getUserQuotaInfo(userId);
        res.json({ message: 'Quota updated successfully', quotaInfo: updatedQuotaInfo });
    }
    catch (error) {
        console.error('Error updating user quota:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/user/:userId/reset', auth_1.authenticateJWT, adminMiddleware_1.adminMiddleware, async (req, res) => {
    try {
        const { userId } = req.params;
        await usageService_1.usageService.resetUserUsage(userId);
        const updatedQuotaInfo = await usageService_1.usageService.getUserQuotaInfo(userId);
        res.json({ message: 'Usage reset successfully', quotaInfo: updatedQuotaInfo });
    }
    catch (error) {
        console.error('Error resetting user usage:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/check', auth_1.authenticateJWT, async (req, res) => {
    try {
        if (!req.user?.sub) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { inputTokens = 0, outputTokens = 0 } = req.body;
        const check = await usageService_1.usageService.checkQuotaAndUsage(req.user.sub, inputTokens, outputTokens);
        return res.json(check);
    }
    catch (error) {
        console.error('Error checking usage quota:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=usage.js.map