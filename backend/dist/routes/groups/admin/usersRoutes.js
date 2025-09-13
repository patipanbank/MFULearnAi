"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        res.json({
            success: true,
            data: [],
            meta: { total: 0 }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get users'
        });
    }
});
router.get('/:userId', auth_1.authenticateToken, auth_1.requireAdmin, async (req, res) => {
    try {
        res.json({
            success: true,
            data: { id: req.params.userId }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get user'
        });
    }
});
exports.default = router;
//# sourceMappingURL=usersRoutes.js.map