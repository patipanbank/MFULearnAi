"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bedrockService_1 = require("../services/bedrockService");
const router = express_1.default.Router();
router.get('/health', async (req, res) => {
    try {
        const healthStatus = await bedrockService_1.bedrockService.healthCheck();
        res.json(healthStatus);
    }
    catch (error) {
        res.status(500).json({
            error: 'Health check failed',
            detail: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/models', async (req, res) => {
    try {
        const models = await bedrockService_1.bedrockService.listModels();
        res.json({
            models,
            count: models.length
        });
    }
    catch (error) {
        res.status(500).json({
            error: 'Failed to list models',
            detail: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/converse-stream', async (req, res) => {
    try {
        const request = req.body;
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });
        const stream = bedrockService_1.bedrockService.converseStream(request.model_id || 'anthropic.claude-3-5-sonnet-20240620-v1:0', request.messages, request.system_prompt || '', request.tool_config, request.temperature, request.top_p);
        for await (const event of stream) {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            res.write(data);
        }
        res.end();
    }
    catch (error) {
        console.error('Error in converse-stream:', error);
        res.status(500).json({
            error: 'Streaming failed',
            detail: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/embeddings/text', async (req, res) => {
    try {
        const { text, model_id } = req.body;
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }
        const embedding = await bedrockService_1.bedrockService.createTextEmbedding(text, model_id);
        return res.json({ embedding });
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to create text embedding',
            detail: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/embeddings/text/batch', async (req, res) => {
    try {
        const { texts, model_id } = req.body;
        if (!texts || !Array.isArray(texts)) {
            return res.status(400).json({ error: 'Texts array is required' });
        }
        const embeddings = await bedrockService_1.bedrockService.createBatchTextEmbeddings(texts, model_id);
        return res.json({ embeddings });
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to create batch text embeddings',
            detail: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/embeddings/image', async (req, res) => {
    try {
        const { image_base64, text, model_id } = req.body;
        if (!image_base64) {
            return res.status(400).json({ error: 'Image base64 is required' });
        }
        const embedding = await bedrockService_1.bedrockService.createImageEmbedding(image_base64, text, model_id);
        return res.json({ embedding });
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to create image embedding',
            detail: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/images/generate', async (req, res) => {
    try {
        const request = req.body;
        if (!request.prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        const image = await bedrockService_1.bedrockService.generateImage(request.prompt, request.width || 1024, request.height || 1024, request.quality || 'standard');
        if (!image) {
            return res.status(500).json({ error: 'No image returned from Bedrock' });
        }
        return res.json({ image });
    }
    catch (error) {
        return res.status(500).json({
            error: 'Failed to generate image',
            detail: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
//# sourceMappingURL=bedrock.js.map