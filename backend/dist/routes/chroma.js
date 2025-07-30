"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const chromaService_1 = require("../services/chromaService");
const router = express_1.default.Router();
router.get('/collections', async (req, res) => {
    try {
        const collections = await chromaService_1.chromaService.listCollections();
        res.json(collections);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Unknown error' });
    }
});
router.post('/collections/:name', async (req, res) => {
    try {
        const collection = await chromaService_1.chromaService.getOrCreateCollection(req.params.name);
        res.json(collection);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Unknown error' });
    }
});
router.delete('/collections/:name', async (req, res) => {
    try {
        await chromaService_1.chromaService.deleteCollection(req.params.name);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Unknown error' });
    }
});
router.post('/collections/:name/add', async (req, res) => {
    const { documents, embeddings, metadatas, ids } = req.body;
    try {
        const result = await chromaService_1.chromaService.addToCollection(req.params.name, documents, embeddings, metadatas, ids);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Unknown error' });
    }
});
router.post('/collections/:name/query', async (req, res) => {
    const { queryEmbeddings, nResults } = req.body;
    try {
        const result = await chromaService_1.chromaService.queryCollection(req.params.name, queryEmbeddings, nResults);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Unknown error' });
    }
});
router.get('/collections/:name/documents', async (req, res) => {
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;
    try {
        const result = await chromaService_1.chromaService.getDocuments(req.params.name, limit, offset);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Unknown error' });
    }
});
router.post('/collections/:name/delete-documents', async (req, res) => {
    const { ids } = req.body;
    try {
        await chromaService_1.chromaService.deleteDocuments(req.params.name, ids);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message || 'Unknown error' });
    }
});
exports.default = router;
//# sourceMappingURL=chroma.js.map