"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bedrockService_1 = require("../services/bedrockService");
const router = express_1.default.Router();
router.post('/converse-stream', async (req, res) => {
    const body = req.body;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    try {
        const modelId = body.model_id || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
        const messages = body.messages || [];
        const systemPrompt = body.system_prompt || '';
        const toolConfig = body.tool_config;
        const temperature = body.temperature;
        const topP = body.top_p;
        for await (const event of bedrockService_1.bedrockService.converseStream(modelId, messages, systemPrompt, toolConfig, temperature, topP)) {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        }
        res.end();
        return;
    }
    catch (error) {
        res.write(`data: ${JSON.stringify({ error: error.message || 'Unknown error' })}\n\n`);
        res.end();
        return;
    }
});
router.post('/generate-image', async (req, res) => {
    const body = req.body;
    try {
        const image = await bedrockService_1.bedrockService.generateImage(body.prompt);
        if (!image) {
            res.status(500).json({ error: 'No image returned from Bedrock' });
            return null;
        }
        res.json({ image });
        return null;
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Unknown error' });
        return null;
    }
});
router.post('/text-embedding', async (req, res) => {
    const body = req.body;
    try {
        const embedding = await bedrockService_1.bedrockService.createTextEmbedding(body.text);
        res.json({ embedding });
        return null;
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Unknown error' });
        return null;
    }
});
router.post('/batch-text-embedding', async (req, res) => {
    const body = req.body;
    try {
        const embeddings = await bedrockService_1.bedrockService.createBatchTextEmbeddings(body.texts);
        res.json({ embeddings });
        return null;
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Unknown error' });
        return null;
    }
});
router.post('/image-embedding', async (req, res) => {
    const body = req.body;
    try {
        const embedding = await bedrockService_1.bedrockService.createImageEmbedding(body.imageBase64, body.text);
        res.json({ embedding });
        return null;
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Unknown error' });
        return null;
    }
});
exports.default = router;
//# sourceMappingURL=bedrock.js.map