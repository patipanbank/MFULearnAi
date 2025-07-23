"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const collectionService_1 = require("../services/collectionService");
const collection_1 = require("../models/collection");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
router.use(auth_1.authenticateJWT, auth_1.requireAnyRole);
router.get('/', async (req, res) => {
    const user = req.user;
    const collections = await collectionService_1.collectionService.getUserCollections(user);
    res.json(collections);
    return;
});
router.get('/public', async (req, res) => {
    const collections = await collectionService_1.collectionService.getAllCollections();
    res.json(collections.filter(c => c.permission === collection_1.CollectionPermission.PUBLIC));
    return;
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
router.put('/:collectionId', async (req, res) => {
    const user = req.user;
    const { collectionId } = req.params;
    const collection = await collectionService_1.collectionService.getCollectionById(collectionId);
    if (!collection) {
        res.status(404).json({ error: 'Collection not found' });
        return null;
    }
    if (!collectionService_1.collectionService.canUserModifyCollection(user, collection)) {
        res.status(403).json({ error: 'Not authorized' });
        return null;
    }
    const updates = req.body;
    const updated = await collectionService_1.collectionService.updateCollection(collectionId, updates);
    res.json(updated);
    return null;
});
router.delete('/:collectionId', async (req, res) => {
    const user = req.user;
    const { collectionId } = req.params;
    const collection = await collectionService_1.collectionService.getCollectionById(collectionId);
    if (!collection) {
        res.status(404).json({ error: 'Collection not found' });
        return null;
    }
    if (!collectionService_1.collectionService.canUserModifyCollection(user, collection)) {
        res.status(403).json({ error: 'Not authorized' });
        return null;
    }
    const ok = await collectionService_1.collectionService.deleteCollection(collectionId);
    if (ok) {
        res.status(204).send();
        return null;
    }
    else {
        res.status(500).json({ error: 'Delete failed' });
        return null;
    }
});
exports.default = router;
//# sourceMappingURL=collection.js.map