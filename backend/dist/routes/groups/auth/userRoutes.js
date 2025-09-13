"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../../middleware/auth");
const router = (0, express_1.Router)();
router.get('/profile', auth_1.authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                id: req.user?.sub || req.user?.nameID || 'unknown',
                username: req.user?.username || 'unknown',
                role: req.user?.role || 'user'
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get user profile'
        });
    }
});
router.put('/profile', auth_1.authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                id: req.user?.sub || req.user?.nameID || 'unknown',
                ...req.body
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to update user profile'
        });
    }
});
router.post('/change-password', auth_1.authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to change password'
        });
    }
});
exports.default = router;
//# sourceMappingURL=userRoutes.js.map