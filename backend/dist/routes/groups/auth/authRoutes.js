"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../../middleware/auth");
const router = (0, express_1.Router)();
router.post('/login', async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                token: 'mock-token',
                user: { id: 'user-1', username: 'test' }
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Login failed'
        });
    }
});
router.post('/logout', auth_1.authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});
router.post('/refresh', async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                token: 'new-mock-token'
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Token refresh failed'
        });
    }
});
exports.default = router;
//# sourceMappingURL=authRoutes.js.map