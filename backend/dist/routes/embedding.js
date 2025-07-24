"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const embeddingService_1 = require("../services/embeddingService");
const router = express_1.default.Router();
router.post('/embedding', async (req, res) => {
    const body = req.body;
    try {
        const embeddings = await embeddingService_1.embeddingService.getTextEmbeddings(body.input, body.model);
        const data = embeddings.map((emb, i) => ({
            object: 'embedding',
            embedding: emb,
            index: i,
        }));
        const response = {
            object: 'list',
            data,
            model: body.model || 'amazon.titan-embed-text-v1',
        };
        res.json(response);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Unknown error' });
    }
});
exports.default = router;
//# sourceMappingURL=embedding.js.map