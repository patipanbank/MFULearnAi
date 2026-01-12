import { Router } from 'express';
import { UserRole } from '../models/User';
import { authenticate, authorize } from '../middleware/auth';
import { createRateLimitMiddleware, uploadRateLimiter } from '../middleware/rateLimiter';
import {
  sanitizeRequestBody,
  validateCollectionName,
  validatePermission,
  checkValidation,
} from '../middleware/inputValidation';
import * as trainingController from '../controllers/training.controller';
import { chromaService } from '../services/chroma';

const router = Router();

// Ensure default collection exists when server starts
chromaService.ensureDefaultCollection().catch((error) => {
  console.error('Failed to create default collection:', error);
});

// All training routes require authentication
router.use(authenticate);

// Standard roles that can access training features
const allowedRoles: UserRole[] = ['Students', 'Staffs', 'Admin', 'SuperAdmin'];

/**
 * File Upload Endpoints
 */
router.post(
  '/upload',
  authorize(allowedRoles),
  createRateLimitMiddleware(uploadRateLimiter),
  trainingController.uploadMiddleware.single('file'),
  trainingController.uploadFile
);

router.post(
  '/documents',
  authorize(allowedRoles),
  createRateLimitMiddleware(uploadRateLimiter),
  trainingController.uploadMiddleware.single('file'),
  trainingController.uploadDocument
);

/**
 * Collection Endpoints
 */
router.get('/collections', authorize(allowedRoles), trainingController.getCollections);

router.post(
  '/collections',
  authorize(allowedRoles),
  sanitizeRequestBody,
  validateCollectionName,
  validatePermission,
  checkValidation,
  trainingController.createCollection
);

router.put('/collections/:id', authorize(allowedRoles), trainingController.updateCollection);

router.delete('/collections/:id', authorize(allowedRoles), trainingController.deleteCollection);

router.delete('/collections', authorize(allowedRoles), trainingController.deleteCollections);

/**
 * Document Endpoints
 */
router.get('/documents', authorize(allowedRoles), trainingController.getDocuments);

router.get('/documents/:filename/content', authorize(allowedRoles), trainingController.getDocumentContent);

router.delete('/documents/:id', authorize(allowedRoles), trainingController.deleteDocument);

router.delete('/documents/all/:collectionName', authorize(allowedRoles), trainingController.deleteAllDocuments);

/**
 * URL Processing
 */
router.post('/add-urls', authorize(allowedRoles), trainingController.addUrls);

/**
 * Cleanup
 */
router.delete('/cleanup', authorize(allowedRoles), trainingController.cleanup);

/**
 * History
 */
router.get('/history', authorize(allowedRoles), trainingController.getHistory);

export default router;
