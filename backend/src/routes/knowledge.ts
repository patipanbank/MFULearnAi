import { Router } from 'express';
import { KnowledgeController } from '../controllers/KnowledgeController';

const router = Router();

// Knowledge CRUD
router.get('/', KnowledgeController.listKnowledge);
router.post('/', KnowledgeController.create);
router.post('/extract', KnowledgeController.extract);
// Static paths must come before /:id parametric routes
router.post('/url', KnowledgeController.createFromUrl);
router.get('/stats', KnowledgeController.getStats);
router.delete('/:id', KnowledgeController.delete);
router.patch('/:id', KnowledgeController.update);
router.post('/:id/retry', KnowledgeController.retry);
router.get('/:id/analytics', KnowledgeController.getDocumentAnalytics);

// Publishing
router.post('/:id/request-publish', KnowledgeController.requestPublish);
router.post('/:id/approve-publish', KnowledgeController.approvePublish);

// Collections
router.get('/collections', KnowledgeController.getCollections);
router.post('/collections', KnowledgeController.createCollection);
router.get('/collections/:id', KnowledgeController.getCollectionDetails);
router.put('/collections/:id', KnowledgeController.updateCollection);
router.delete('/collections/:id', KnowledgeController.deleteCollection);
router.post('/collections/:id/map', KnowledgeController.mapKnowledge);

// View
router.get('/:id/view', KnowledgeController.view);
// router.get('/:id/stream', KnowledgeController.view); // Alias

export default router;
