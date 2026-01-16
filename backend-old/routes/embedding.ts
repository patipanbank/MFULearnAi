import { Router } from 'express';
import * as embeddingController from '../controllers/embedding.controller';

const router = Router();

/**
 * POST /api/embed - Generate embedding for text
 * Note: This endpoint might need authentication in the future
 */
router.post('/', embeddingController.generateEmbedding);

export default router;
