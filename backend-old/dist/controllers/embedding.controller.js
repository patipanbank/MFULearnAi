"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEmbedding = void 0;
const titan_1 = require("../services/titan");
const errorHandler_1 = require("../middleware/errorHandler");
const errors_1 = require("../errors");
/**
 * POST /api/embed - Generate embedding for text
 */
exports.generateEmbedding = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { inputText } = req.body;
    if (!inputText) {
        throw new errors_1.BadRequestError('inputText is required');
    }
    const embedding = await titan_1.titanEmbedService.embedText(inputText);
    res.json({ embedding });
});
