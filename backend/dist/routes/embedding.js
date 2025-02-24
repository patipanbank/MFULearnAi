"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const titan_1 = require("../services/titan");
const router = (0, express_1.Router)();
/**
 * POST /api/embed
 * Expects: { inputText: string }
 * Returns: { embedding: number[] }
 */
router.post('/', async (req, res, next) => {
    try {
        const { inputText } = req.body;
        if (!inputText) {
            res.status(400).json({ error: 'inputText is required' });
            return;
        }
        const embedding = await titan_1.titanEmbedService.embedText(inputText);
        res.json({ embedding });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
