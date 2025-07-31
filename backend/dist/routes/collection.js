"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const collectionService_1 = require("../services/collectionService");
const chromaService_1 = require("../services/chromaService");
const collection_1 = require("../models/collection");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticateJWT, auth_1.requireAnyRole);
router.get('/analytics', async (req, res) => {
    try {
        const user = req.user;
        const collections = await collectionService_1.collectionService.getAllCollections();
        let totalCollections = collections.length;
        let totalDocuments = 0;
        let totalSize = 0;
        for (const collection of collections) {
            try {
                const documents = await chromaService_1.chromaService.getDocuments(collection.name, 1, 0);
                totalDocuments += documents.total || 0;
                totalSize += (documents.total || 0) * 1024;
            }
            catch (error) {
                console.error(`Error getting analytics for collection ${collection.name}:`, error);
                continue;
            }
        }
        res.json({
            totalCollections,
            totalDocuments,
            totalSize
        });
    }
    catch (error) {
        res.status(500).json({ error: `Failed to get analytics: ${error.message}` });
    }
});
router.get('/stats', async (req, res) => {
    try {
        const stats = await collectionService_1.collectionService.getCollectionStats();
        if (stats) {
            res.json(stats);
        }
        else {
            res.status(500).json({ error: 'Failed to get collection statistics' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/public', async (req, res) => {
    try {
        const collections = await collectionService_1.collectionService.getAllCollections();
        const publicCollections = collections.filter(c => c.permission === collection_1.CollectionPermission.PUBLIC);
        res.json(publicCollections);
    }
    catch (error) {
        res.json([]);
    }
});
router.get('/search/:query', async (req, res) => {
    try {
        const user = req.user;
        const { query } = req.params;
        const collections = await collectionService_1.collectionService.searchCollections(query, user.username, user.department);
        res.json(collections);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const collections = await collectionService_1.collectionService.getCollectionsByUser(userId);
        res.json(collections);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/department/:department', async (req, res) => {
    try {
        const { department } = req.params;
        const collections = await collectionService_1.collectionService.getCollectionsByDepartment(department);
        res.json(collections);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/', async (req, res) => {
    try {
        const user = req.user;
        const collections = await collectionService_1.collectionService.getUserCollections(user);
        res.json(collections);
    }
    catch (error) {
        console.error('Error getting user collections:', error);
        res.status(500).json({ error: 'Failed to get collections' });
    }
});
router.post('/', async (req, res) => {
    try {
        const user = req.user;
        const { name, permission, modelId } = req.body;
        const collection = await collectionService_1.collectionService.createCollection(name, permission, user, modelId);
        res.status(201).json(collection);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
router.get('/:collectionId', async (req, res) => {
    try {
        const user = req.user;
        const { collectionId } = req.params;
        const collection = await collectionService_1.collectionService.getCollectionById(collectionId);
        if (!collection) {
            res.status(404).json({ error: 'Collection not found' });
            return;
        }
        if (!collectionService_1.collectionService.canUserAccessCollection(user, collection)) {
            res.status(403).json({ error: 'Not authorized to access this collection' });
            return;
        }
        res.json(collection);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:collectionId', async (req, res) => {
    try {
        const user = req.user;
        const { collectionId } = req.params;
        const collection = await collectionService_1.collectionService.getCollectionById(collectionId);
        if (!collection) {
            res.status(404).json({ error: 'Collection not found' });
            return;
        }
        if (!collectionService_1.collectionService.canUserModifyCollection(user, collection)) {
            res.status(403).json({ error: 'Not authorized to update this collection' });
            return;
        }
        const updates = req.body;
        const updated = await collectionService_1.collectionService.updateCollection(collectionId, updates, user);
        if (updated) {
            res.json(updated);
        }
        else {
            res.status(400).json({ error: 'Failed to update collection' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.delete('/:collectionId', async (req, res) => {
    try {
        const user = req.user;
        const { collectionId } = req.params;
        const collection = await collectionService_1.collectionService.getCollectionById(collectionId);
        if (!collection) {
            res.status(404).json({ error: 'Collection not found' });
            return;
        }
        if (!collectionService_1.collectionService.canUserModifyCollection(user, collection)) {
            res.status(403).json({ error: 'Not authorized to delete this collection' });
            return;
        }
        const ok = await collectionService_1.collectionService.deleteCollection(collectionId, user);
        if (ok) {
            res.status(204).send();
        }
        else {
            res.status(500).json({ error: 'Failed to delete collection' });
        }
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:collectionId/documents', async (req, res) => {
    try {
        const user = req.user;
        const { collectionId } = req.params;
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;
        const collection = await collectionService_1.collectionService.getCollectionById(collectionId);
        if (!collection) {
            res.status(404).json({ error: 'Collection not found' });
            return;
        }
        if (!collectionService_1.collectionService.canUserAccessCollection(user, collection)) {
            res.status(403).json({ error: 'Not authorized to view documents in this collection' });
            return;
        }
        const result = await chromaService_1.chromaService.getDocuments(collection.name, limit, offset);
        if (!result) {
            res.json([]);
            return;
        }
        res.json(result.documents || []);
    }
    catch (error) {
        console.error(`Error getting documents for collection ${req.params.collectionId}:`, error);
        res.status(500).json({ error: `Failed to get documents: ${error.message}` });
    }
});
router.delete('/:collectionId/documents', async (req, res) => {
    try {
        const user = req.user;
        const { collectionId } = req.params;
        const { documentIds } = req.body;
        const collection = await collectionService_1.collectionService.getCollectionById(collectionId);
        if (!collection) {
            res.status(404).json({ error: 'Collection not found' });
            return;
        }
        if (!collectionService_1.collectionService.canUserModifyCollection(user, collection)) {
            res.status(403).json({ error: 'Not authorized to delete documents from this collection' });
            return;
        }
        await chromaService_1.chromaService.deleteDocuments(collection.name, documentIds);
        res.json({ message: `${documentIds.length} documents deleted successfully.` });
    }
    catch (error) {
        res.status(500).json({ error: `Failed to delete documents: ${error.message}` });
    }
});
exports.default = router;
//# sourceMappingURL=collection.js.map