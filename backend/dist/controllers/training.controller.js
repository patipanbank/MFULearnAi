"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistory = exports.cleanup = exports.addUrls = exports.deleteAllDocuments = exports.deleteDocument = exports.getDocumentContent = exports.getDocuments = exports.deleteCollections = exports.deleteCollection = exports.updateCollection = exports.createCollection = exports.getCollections = exports.uploadDocument = exports.uploadFile = exports.uploadMiddleware = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const chroma_1 = require("../services/chroma");
const titan_1 = require("../services/titan");
const textUtils_1 = require("../utils/textUtils");
const webScraper_1 = require("../services/webScraper");
const Collection_1 = require("../models/Collection");
const TrainingHistory_1 = require("../models/TrainingHistory");
const errorHandler_1 = require("../middleware/errorHandler");
const errors_1 = require("../errors");
const training_service_1 = require("../services/training.service");
const constants_1 = require("../constants");
// Helper to create typed async handler
const authHandler = (fn) => (0, errorHandler_1.asyncHandler)(fn);
// Multer configuration
exports.uploadMiddleware = (0, multer_1.default)({
    dest: 'uploads/',
    limits: {
        fileSize: constants_1.FILE_UPLOAD_LIMITS.MAX_FILE_SIZE,
    },
    fileFilter: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (constants_1.FILE_UPLOAD_LIMITS.ALLOWED_FILE_TYPES.includes(ext)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Invalid file type. Supported formats: ${constants_1.FILE_UPLOAD_LIMITS.ALLOWED_FILE_TYPES.join(', ')}`));
        }
    },
});
/**
 * POST /api/training/upload - Upload and process file
 */
exports.uploadFile = authHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
        throw new errors_1.BadRequestError('No file uploaded');
    }
    const { modelId, collectionName } = req.body;
    if (!modelId || !collectionName) {
        throw new errors_1.BadRequestError('Both modelId and collectionName are required');
    }
    const documents = await (0, training_service_1.processFileDocuments)(file, req.user, modelId, collectionName);
    await chroma_1.chromaService.addDocuments(collectionName, documents);
    const userId = req.user.nameID || req.user.username;
    if (!userId) {
        throw new errors_1.BadRequestError('User identifier not found');
    }
    // Track the upload in history
    await TrainingHistory_1.TrainingHistory.create({
        userId,
        username: req.user.username,
        collectionName,
        documentName: file.originalname,
        action: 'upload',
        details: {
            modelId,
            chunks: documents.length,
            fileSize: file.size,
        },
    });
    res.json({
        message: 'File processed successfully with vector embeddings',
        chunks: documents.length,
        filename: file.originalname,
    });
});
/**
 * POST /api/training/documents - Upload document (ensures collection exists)
 */
exports.uploadDocument = authHandler(async (req, res) => {
    const { modelId, collectionName } = req.body;
    if (!modelId || !collectionName) {
        throw new errors_1.BadRequestError('Both modelId and collectionName are required');
    }
    // Ensure the collection exists
    await chroma_1.chromaService.ensureCollectionExists(collectionName, req.user);
    const file = req.file;
    if (!file) {
        throw new errors_1.BadRequestError('No file uploaded');
    }
    const documents = await (0, training_service_1.processFileDocuments)(file, req.user, modelId, collectionName);
    await chroma_1.chromaService.addDocuments(collectionName, documents);
    res.json({
        message: 'File processed successfully with embeddings',
        chunks: documents.length,
        filename: file.originalname,
    });
});
/**
 * GET /api/training/collections - Get all collections
 */
exports.getCollections = authHandler(async (req, res) => {
    const collections = await Collection_1.CollectionModel.find({}).lean();
    res.json(collections.map((collection) => ({
        id: collection._id.toString(),
        name: collection.name,
        permission: collection.permission,
        createdBy: collection.createdBy,
        createdAt: collection.createdAt,
    })));
});
/**
 * POST /api/training/collections - Create new collection
 */
exports.createCollection = authHandler(async (req, res) => {
    const { name, permission } = req.body;
    const user = req.user;
    const createdBy = user.nameID || user.username;
    if (!createdBy) {
        throw new errors_1.BadRequestError('User identifier not found');
    }
    const newCollection = await chroma_1.chromaService.createCollection(name, permission, createdBy);
    // Track collection creation
    await TrainingHistory_1.TrainingHistory.create({
        userId: user.nameID || user.username,
        username: user.username,
        collectionName: name,
        action: 'create_collection',
        details: {
            permission,
        },
    });
    res.status(201).json({
        message: 'Collection created successfully',
        collection: {
            id: newCollection.id.toString(),
            name: newCollection.name,
            permission: newCollection.permission,
            createdBy: newCollection.createdBy,
        },
    });
});
/**
 * PUT /api/training/collections/:id - Update collection
 */
exports.updateCollection = authHandler(async (req, res) => {
    const { id } = req.params;
    const { name: newName, permission } = req.body;
    const user = req.user;
    const collection = await Collection_1.CollectionModel.findById(id).exec();
    if (!collection) {
        throw new errors_1.NotFoundError('Collection not found');
    }
    const canAccess = collection.permission === Collection_1.CollectionPermission.PUBLIC ||
        collection.permission === Collection_1.CollectionPermission.PRIVATE ||
        collection.createdBy === user.nameID;
    if (!canAccess) {
        throw new errors_1.ForbiddenError('Permission denied');
    }
    collection.name = newName;
    collection.permission = permission;
    await collection.save();
    res.json({ message: 'Collection updated successfully' });
});
/**
 * DELETE /api/training/collections/:id - Delete single collection
 */
exports.deleteCollection = authHandler(async (req, res) => {
    const { id } = req.params;
    const user = req.user;
    const collection = await Collection_1.CollectionModel.findById(id);
    if (!collection) {
        throw new errors_1.NotFoundError('Collection not found');
    }
    if (!(await (0, training_service_1.checkCollectionAccess)(user, collection))) {
        throw new errors_1.ForbiddenError('Permission denied');
    }
    const userId = user.nameID || user.username;
    if (!userId) {
        throw new errors_1.BadRequestError('User identifier not found');
    }
    // Track collection deletion
    await TrainingHistory_1.TrainingHistory.create({
        userId,
        username: user.username,
        collectionName: collection.name,
        action: 'delete_collection',
    });
    await chroma_1.chromaService.deleteCollection(collection.name);
    res.json({ message: 'Collection deleted successfully' });
});
/**
 * DELETE /api/training/collections - Delete multiple collections
 */
exports.deleteCollections = authHandler(async (req, res) => {
    const { collections } = req.body;
    if (!Array.isArray(collections)) {
        throw new errors_1.BadRequestError('Invalid collections array');
    }
    const collectionNames = [];
    for (const id of collections) {
        const coll = await Collection_1.CollectionModel.findById(id);
        if (!coll) {
            throw new errors_1.NotFoundError(`Collection not found for id: ${id}`);
        }
        if (!(await (0, training_service_1.checkCollectionAccess)(req.user, coll))) {
            throw new errors_1.ForbiddenError(`Permission denied for collection with id: ${id}`);
        }
        collectionNames.push(coll.name);
    }
    await chroma_1.chromaService.deleteCollections(collectionNames);
    res.json({ message: 'Collections deleted successfully' });
});
/**
 * GET /api/training/documents - Get documents for collection
 */
exports.getDocuments = authHandler(async (req, res) => {
    const { collectionName } = req.query;
    if (!collectionName || typeof collectionName !== 'string') {
        throw new errors_1.BadRequestError('Collection name is required');
    }
    const collection = await Collection_1.CollectionModel.findOne({ name: collectionName }).exec();
    if (!collection) {
        throw new errors_1.NotFoundError('Collection not found');
    }
    const userId = req.user.nameID || req.user.username;
    const canAccess = collection.permission === Collection_1.CollectionPermission.PUBLIC || collection.createdBy === userId;
    if (!canAccess) {
        throw new errors_1.ForbiddenError('No permission to access this collection');
    }
    const docsData = await chroma_1.chromaService.getAllDocuments(collectionName);
    // Group document chunks by filename
    const filesMap = {};
    for (let i = 0; i < docsData.metadatas.length; i++) {
        const metadata = docsData.metadatas[i];
        const id = docsData.ids[i];
        if (metadata && metadata.filename) {
            const filename = metadata.filename;
            if (!filesMap[filename]) {
                filesMap[filename] = {
                    filename,
                    uploadedBy: metadata.uploadedBy,
                    timestamp: metadata.timestamp,
                    ids: [],
                };
            }
            filesMap[filename].ids.push(id);
        }
    }
    res.json(Object.values(filesMap));
});
/**
 * GET /api/training/documents/:filename/content - Get document content
 */
exports.getDocumentContent = authHandler(async (req, res) => {
    const filename = decodeURIComponent(req.params.filename);
    const { collectionName } = req.query;
    if (!collectionName || typeof collectionName !== 'string') {
        throw new errors_1.BadRequestError('Collection name is required');
    }
    const collection = await Collection_1.CollectionModel.findOne({ name: collectionName }).exec();
    if (!collection) {
        throw new errors_1.NotFoundError('Collection not found');
    }
    const userId = req.user.nameID || req.user.username;
    const canAccess = collection.permission === Collection_1.CollectionPermission.PUBLIC || collection.createdBy === userId;
    if (!canAccess) {
        throw new errors_1.ForbiddenError('No permission to access this collection');
    }
    const docsData = await chroma_1.chromaService.getAllDocuments(collectionName);
    const chunks = docsData.documents
        .map((doc, index) => ({
        id: docsData.ids[index],
        text: doc,
        metadata: docsData.metadatas[index],
    }))
        .filter((chunk) => chunk.metadata?.filename === filename)
        .sort((a, b) => (a.metadata?.chunkIndex || 0) - (b.metadata?.chunkIndex || 0));
    if (chunks.length === 0) {
        throw new errors_1.NotFoundError('Document not found');
    }
    res.json({
        filename: chunks[0].metadata?.filename || filename,
        uploadedBy: chunks[0].metadata?.uploadedBy || 'Unknown',
        timestamp: chunks[0].metadata?.timestamp || new Date().toISOString(),
        chunks: chunks.map((chunk, index) => ({
            id: chunk.id,
            text: chunk.text,
            chunkIndex: index + 1,
        })),
    });
});
/**
 * DELETE /api/training/documents/:id - Delete document
 */
exports.deleteDocument = authHandler(async (req, res) => {
    const { id } = req.params;
    const { collectionName } = req.query;
    if (!id || !collectionName || typeof collectionName !== 'string') {
        throw new errors_1.BadRequestError('Missing document ID or collection name');
    }
    const collection = await Collection_1.CollectionModel.findOne({ name: collectionName }).exec();
    if (!collection) {
        throw new errors_1.NotFoundError('Collection not found');
    }
    const canDelete = req.user.groups.includes('Staffs') || collection.createdBy === (req.user.nameID || req.user.username);
    if (!canDelete) {
        throw new errors_1.ForbiddenError('No permission to delete this document');
    }
    await chroma_1.chromaService.deleteDocument(collectionName, id);
    res.status(200).json({ message: 'Document deleted successfully' });
});
/**
 * DELETE /api/training/documents/all/:collectionName - Delete all documents in collection
 */
exports.deleteAllDocuments = authHandler(async (req, res) => {
    const { collectionName } = req.params;
    await chroma_1.chromaService.deleteAllDocuments(collectionName);
    res.status(200).json({ message: 'All documents deleted successfully' });
});
/**
 * POST /api/training/add-urls - Process URLs and add to collection
 */
exports.addUrls = authHandler(async (req, res) => {
    const { urls, modelId, collectionName } = req.body;
    if (!Array.isArray(urls) || urls.length === 0) {
        throw new errors_1.BadRequestError('URLs array is required');
    }
    const results = await Promise.all(urls.map(async (url) => {
        try {
            const content = await webScraper_1.webScraperService.scrapeUrl(url);
            const chunks = (0, textUtils_1.splitTextIntoChunks)(content);
            const documents = await Promise.all(chunks.map(async (chunk) => {
                const embedResult = await titan_1.titanEmbedService.embedText(chunk);
                return {
                    text: chunk,
                    metadata: {
                        url,
                        uploadedBy: req.user.username,
                        timestamp: new Date().toISOString(),
                        modelId,
                        collectionName,
                    },
                    embedding: embedResult,
                };
            }));
            await chroma_1.chromaService.addDocuments(collectionName, documents);
            return { url, success: true, chunks: documents.length };
        }
        catch (error) {
            console.error(`Error processing URL ${url}:`, error);
            return { url, success: false, error: error.message };
        }
    }));
    res.json({ results });
});
/**
 * DELETE /api/training/cleanup - Cleanup orphaned documents
 */
exports.cleanup = authHandler(async (req, res) => {
    await chroma_1.chromaService.deleteDocumentsWithoutModelOrCollection();
    res.json({ message: 'Cleanup completed successfully' });
});
/**
 * GET /api/training/history - Get training history
 */
exports.getHistory = authHandler(async (req, res) => {
    const user = req.user;
    let query = {};
    // If not admin or staff, only show user's own history
    if (!user.groups.includes('Admin') && !user.groups.includes('SuperAdmin')) {
        query = { userId: user.nameID || user.username };
    }
    const history = await TrainingHistory_1.TrainingHistory.find(query).sort({ timestamp: -1 }).limit(50);
    res.json(history);
});
