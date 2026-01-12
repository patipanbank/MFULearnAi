import { Response } from 'express';
import multer from 'multer';
import path from 'path';
import { AuthenticatedRequest } from '../types/common';
import { chromaService } from '../services/chroma';
import { titanEmbedService } from '../services/titan';
import { splitTextIntoChunks } from '../utils/textUtils';
import { webScraperService } from '../services/webScraper';
import { CollectionModel, CollectionDocument, CollectionPermission } from '../models/Collection';
import { TrainingHistory } from '../models/TrainingHistory';
import { asyncHandler } from '../middleware/errorHandler';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  InternalError,
} from '../errors';
import { processFileDocuments, checkCollectionAccess } from '../services/training.service';
import { FILE_UPLOAD_LIMITS } from '../constants';

// Helper to create typed async handler
const authHandler = (fn: (req: AuthenticatedRequest, res: Response) => Promise<void>) =>
  asyncHandler<AuthenticatedRequest>(fn);

// Multer configuration
export const uploadMiddleware = multer({
  dest: 'uploads/',
  limits: {
    fileSize: FILE_UPLOAD_LIMITS.MAX_FILE_SIZE,
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (FILE_UPLOAD_LIMITS.ALLOWED_FILE_TYPES.includes(ext as any)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Supported formats: ${FILE_UPLOAD_LIMITS.ALLOWED_FILE_TYPES.join(', ')}`));
    }
  },
});

/**
 * POST /api/training/upload - Upload and process file
 */
export const uploadFile = authHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const file = req.file;
  if (!file) {
    throw new BadRequestError('No file uploaded');
  }

  const { modelId, collectionName } = req.body;
  if (!modelId || !collectionName) {
    throw new BadRequestError('Both modelId and collectionName are required');
  }

  const documents = await processFileDocuments(file, req.user, modelId, collectionName);
  await chromaService.addDocuments(collectionName, documents);

  const userId = req.user.nameID || req.user.username;
  if (!userId) {
    throw new BadRequestError('User identifier not found');
  }

  // Track the upload in history
  await TrainingHistory.create({
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
export const uploadDocument = authHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { modelId, collectionName } = req.body;
  if (!modelId || !collectionName) {
    throw new BadRequestError('Both modelId and collectionName are required');
  }

  // Ensure the collection exists
  await chromaService.ensureCollectionExists(collectionName, req.user);

  const file = req.file;
  if (!file) {
    throw new BadRequestError('No file uploaded');
  }

  const documents = await processFileDocuments(file, req.user, modelId, collectionName);
  await chromaService.addDocuments(collectionName, documents);

  res.json({
    message: 'File processed successfully with embeddings',
    chunks: documents.length,
    filename: file.originalname,
  });
});

/**
 * GET /api/training/collections - Get all collections
 */
export const getCollections = authHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const collections = await CollectionModel.find({}).lean() as (CollectionDocument & { _id: any })[];
  res.json(
    collections.map((collection) => ({
      id: collection._id.toString(),
      name: collection.name,
      permission: collection.permission,
      createdBy: collection.createdBy,
      createdAt: collection.createdAt,
    }))
  );
});

/**
 * POST /api/training/collections - Create new collection
 */
export const createCollection = authHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { name, permission } = req.body;
  const user = req.user;

  const createdBy = user.nameID || user.username;
  if (!createdBy) {
    throw new BadRequestError('User identifier not found');
  }

  const newCollection = await chromaService.createCollection(name, permission, createdBy);

  // Track collection creation
  await TrainingHistory.create({
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
export const updateCollection = authHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name: newName, permission } = req.body;
  const user = req.user;

  const collection = await CollectionModel.findById(id).exec();
  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  const canAccess =
    collection.permission === CollectionPermission.PUBLIC ||
    collection.permission === CollectionPermission.PRIVATE ||
    collection.createdBy === user.nameID;
  if (!canAccess) {
    throw new ForbiddenError('Permission denied');
  }

  collection.name = newName;
  collection.permission = permission;
  await collection.save();

  res.json({ message: 'Collection updated successfully' });
});

/**
 * DELETE /api/training/collections/:id - Delete single collection
 */
export const deleteCollection = authHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const user = req.user;

  const collection = await CollectionModel.findById(id);
  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  if (!(await checkCollectionAccess(user, collection))) {
    throw new ForbiddenError('Permission denied');
  }

  const userId = user.nameID || user.username;
  if (!userId) {
    throw new BadRequestError('User identifier not found');
  }

  // Track collection deletion
  await TrainingHistory.create({
    userId,
    username: user.username,
    collectionName: collection.name,
    action: 'delete_collection',
  });

  await chromaService.deleteCollection(collection.name);
  res.json({ message: 'Collection deleted successfully' });
});

/**
 * DELETE /api/training/collections - Delete multiple collections
 */
export const deleteCollections = authHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { collections } = req.body;
  if (!Array.isArray(collections)) {
    throw new BadRequestError('Invalid collections array');
  }

  const collectionNames: string[] = [];
  for (const id of collections) {
    const coll = await CollectionModel.findById(id);
    if (!coll) {
      throw new NotFoundError(`Collection not found for id: ${id}`);
    }
    if (!(await checkCollectionAccess(req.user, coll))) {
      throw new ForbiddenError(`Permission denied for collection with id: ${id}`);
    }
    collectionNames.push(coll.name);
  }

  await chromaService.deleteCollections(collectionNames);
  res.json({ message: 'Collections deleted successfully' });
});

/**
 * GET /api/training/documents - Get documents for collection
 */
export const getDocuments = authHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { collectionName } = req.query;
  if (!collectionName || typeof collectionName !== 'string') {
    throw new BadRequestError('Collection name is required');
  }

  const collection = await CollectionModel.findOne({ name: collectionName }).exec();
  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  const userId = req.user.nameID || req.user.username;
  const canAccess = collection.permission === CollectionPermission.PUBLIC || collection.createdBy === userId;
  if (!canAccess) {
    throw new ForbiddenError('No permission to access this collection');
  }

  const docsData = await chromaService.getAllDocuments(collectionName);

  // Group document chunks by filename
  const filesMap: {
    [filename: string]: { filename: string; uploadedBy: string; timestamp: string; ids: string[] };
  } = {};

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
export const getDocumentContent = authHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const filename = decodeURIComponent(req.params.filename);
  const { collectionName } = req.query;
  if (!collectionName || typeof collectionName !== 'string') {
    throw new BadRequestError('Collection name is required');
  }

  const collection = await CollectionModel.findOne({ name: collectionName }).exec();
  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  const userId = req.user.nameID || req.user.username;
  const canAccess = collection.permission === CollectionPermission.PUBLIC || collection.createdBy === userId;
  if (!canAccess) {
    throw new ForbiddenError('No permission to access this collection');
  }

  const docsData = await chromaService.getAllDocuments(collectionName);

  const chunks = docsData.documents
    .map((doc: string, index: number) => ({
      id: docsData.ids[index],
      text: doc,
      metadata: docsData.metadatas[index],
    }))
    .filter((chunk: any) => chunk.metadata?.filename === filename)
    .sort((a: any, b: any) => (a.metadata?.chunkIndex || 0) - (b.metadata?.chunkIndex || 0));

  if (chunks.length === 0) {
    throw new NotFoundError('Document not found');
  }

  res.json({
    filename: chunks[0].metadata?.filename || filename,
    uploadedBy: chunks[0].metadata?.uploadedBy || 'Unknown',
    timestamp: chunks[0].metadata?.timestamp || new Date().toISOString(),
    chunks: chunks.map((chunk: any, index: number) => ({
      id: chunk.id,
      text: chunk.text,
      chunkIndex: index + 1,
    })),
  });
});

/**
 * DELETE /api/training/documents/:id - Delete document
 */
export const deleteDocument = authHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { collectionName } = req.query;
  if (!id || !collectionName || typeof collectionName !== 'string') {
    throw new BadRequestError('Missing document ID or collection name');
  }

  const collection = await CollectionModel.findOne({ name: collectionName }).exec();
  if (!collection) {
    throw new NotFoundError('Collection not found');
  }

  const canDelete =
    req.user.groups.includes('Staffs') || collection.createdBy === (req.user.nameID || req.user.username);
  if (!canDelete) {
    throw new ForbiddenError('No permission to delete this document');
  }

  await chromaService.deleteDocument(collectionName, id);
  res.status(200).json({ message: 'Document deleted successfully' });
});

/**
 * DELETE /api/training/documents/all/:collectionName - Delete all documents in collection
 */
export const deleteAllDocuments = authHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { collectionName } = req.params;
  await chromaService.deleteAllDocuments(collectionName);
  res.status(200).json({ message: 'All documents deleted successfully' });
});

/**
 * POST /api/training/add-urls - Process URLs and add to collection
 */
export const addUrls = authHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { urls, modelId, collectionName } = req.body;
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new BadRequestError('URLs array is required');
  }

  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const content = await webScraperService.scrapeUrl(url);
        const chunks = splitTextIntoChunks(content);
        const documents = await Promise.all(
          chunks.map(async (chunk) => {
            const embedResult = await titanEmbedService.embedText(chunk);
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
          })
        );
        await chromaService.addDocuments(collectionName, documents);
        return { url, success: true, chunks: documents.length };
      } catch (error: any) {
        console.error(`Error processing URL ${url}:`, error);
        return { url, success: false, error: error.message };
      }
    })
  );

  res.json({ results });
});

/**
 * DELETE /api/training/cleanup - Cleanup orphaned documents
 */
export const cleanup = authHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  await chromaService.deleteDocumentsWithoutModelOrCollection();
  res.json({ message: 'Cleanup completed successfully' });
});

/**
 * GET /api/training/history - Get training history
 */
export const getHistory = authHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const user = req.user;
  let query: Record<string, unknown> = {};

  // If not admin or staff, only show user's own history
  if (!user.groups.includes('Admin') && !user.groups.includes('SuperAdmin')) {
    query = { userId: user.nameID || user.username };
  }

  const history = await TrainingHistory.find(query).sort({ timestamp: -1 }).limit(50);
  res.json(history);
});
