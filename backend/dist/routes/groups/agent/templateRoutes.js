"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticateToken, async (req, res) => {
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
            error: 'Failed to get agent templates'
        });
    }
});
router.post('/:templateId/create', auth_1.authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            data: {
                id: 'agent-' + Date.now(),
                templateId: req.params.templateId
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to create agent from template'
        });
    }
});
exports.default = router;
//# sourceMappingURL=templateRoutes.js.map