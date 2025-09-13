"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../../middleware/auth");
const router = (0, express_1.Router)();
router.post('/documents', auth_1.authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            data: [],
            meta: {
                total: 0,
                query: req.body.query
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to search documents'
        });
    }
});
router.post('/collections/:collectionId', auth_1.authenticateToken, async (req, res) => {
    try {
        res.json({
            success: true,
            data: [],
            meta: {
                total: 0,
                collectionId: req.params.collectionId,
                query: req.body.query
            }
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to search in collection'
        });
    }
});
exports.default = router;
//# sourceMappingURL=searchRoutes.js.map