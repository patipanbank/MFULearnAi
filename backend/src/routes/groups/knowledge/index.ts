import express from 'express';
import collectionRoutes from './collectionRoutes';
import documentRoutes from './documentRoutes';
import searchRoutes from './searchRoutes';
import embeddingRoutes from './embeddingRoutes';

/**
 * Knowledge Group Routes - จัดกลุ่ม routes ที่เกี่ยวกับ knowledge base
 */
const router = express.Router();

// Sub-routes
router.use('/collections', collectionRoutes);  // /api/knowledge/collections/*
router.use('/documents', documentRoutes);      // /api/knowledge/documents/*
router.use('/search', searchRoutes);           // /api/knowledge/search/*
router.use('/embeddings', embeddingRoutes);    // /api/knowledge/embeddings/*

export { router as knowledgeGroupRoutes };