import { Router } from 'express';
import { KnowledgeController } from '../controllers/KnowledgeController';
import { AuthService } from '../auth/AuthService';
import { KnowledgeGuard } from '../middleware/knowledgeGuard';

const router = Router();
const requireAdmin = AuthService.requireRole(['admin', 'superadmin']);

// Enterprise middleware chain for upload endpoints
const uploadGuard = [
    KnowledgeGuard.auditEnrich,
    KnowledgeGuard.uploadRateLimit,
    KnowledgeGuard.concurrencyLimit,
    KnowledgeGuard.preflightCheck
];

// Knowledge CRUD
router.get('/', KnowledgeController.listKnowledge);
router.post('/', ...uploadGuard, KnowledgeController.create);
router.post('/extract', KnowledgeGuard.preflightCheck, KnowledgeController.extract);
// Static paths must come before /:id parametric routes
router.post('/url', ...uploadGuard, KnowledgeController.createFromUrl);
router.post('/text', ...uploadGuard, KnowledgeController.createFromText);
router.get('/stats', requireAdmin, KnowledgeController.getStats);
router.delete('/:id', KnowledgeGuard.auditEnrich, KnowledgeController.delete);
router.patch('/:id', KnowledgeGuard.auditEnrich, KnowledgeController.update);
router.post('/:id/retry', KnowledgeGuard.auditEnrich, KnowledgeController.retry);
router.get('/:id/analytics', KnowledgeController.getDocumentAnalytics);

// Publishing
router.post('/:id/request-publish', KnowledgeGuard.auditEnrich, KnowledgeController.requestPublish);
router.post('/:id/approve-publish', requireAdmin, KnowledgeGuard.auditEnrich, KnowledgeController.approvePublish);

// Collections
router.get('/collections', KnowledgeController.getCollections);
router.post('/collections', KnowledgeController.createCollection);
router.get('/collections/:id', KnowledgeController.getCollectionDetails);
router.put('/collections/:id', KnowledgeController.updateCollection);
router.delete('/collections/:id', KnowledgeController.deleteCollection);
router.post('/collections/:id/map', KnowledgeController.mapKnowledge);

// View
router.get('/:id/view', KnowledgeController.view);

export default router;
