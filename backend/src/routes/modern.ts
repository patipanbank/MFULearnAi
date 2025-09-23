/**
 * 🚀 Modern System Routes
 *
 * API endpoints สำหรับระบบใหม่ที่เน้น LangChain/LangMem
 * - Modern chat processing
 * - Health checks
 * - Performance benchmarks
 * - Knowledge retrieval testing
 */

import express from 'express';
import { authenticateJWT } from '../middleware/auth';
import { modernSystemIntegration } from '../core/modernSystemIntegration';

const router = express.Router();

/**
 * POST /api/modern/chat
 * Process chat message with modern system
 */
router.post('/chat', authenticateJWT, async (req, res) => {
  await modernSystemIntegration.handleChatMessage(req, res);
});

/**
 * GET /api/modern/health
 * Health check for modern system
 */
router.get('/health', async (req, res) => {
  try {
    const healthCheck = await modernSystemIntegration.healthCheck();
    res.json(healthCheck);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      system: 'modern',
      error: (error as Error).message
    });
  }
});

/**
 * GET /api/modern/benchmark
 * Performance benchmark for modern system
 */
router.get('/benchmark', async (req, res) => {
  try {
    const benchmark = await modernSystemIntegration.runBenchmark();
    res.json(benchmark);
  } catch (error) {
    res.status(500).json({
      system: 'modern',
      error: (error as Error).message,
      benchmark: 'failed'
    });
  }
});

/**
 * POST /api/modern/test-knowledge
 * Test knowledge retrieval functionality
 */
router.post('/test-knowledge', async (req, res) => {
  try {
    const { query, collections } = req.body;

    if (!query || !collections || !Array.isArray(collections)) {
      return res.status(400).json({
        error: 'Missing required fields: query (string), collections (array)'
      });
    }

    const testResult = await modernSystemIntegration.testKnowledgeRetrieval(query, collections);
    return res.json(testResult);

  } catch (error) {
    return res.status(500).json({
      error: 'Knowledge retrieval test failed',
      details: (error as Error).message
    });
  }
});

/**
 * GET /api/modern/status
 * Get current system status
 */
router.get('/status', (req, res) => {
  const status = modernSystemIntegration.getStatus();
  return res.json(status);
});

/**
 * POST /api/modern/enable
 * Enable/disable modern system
 */
router.post('/enable', authenticateJWT, (req, res) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'enabled field must be a boolean'
      });
    }

    modernSystemIntegration.setEnabled(enabled);

    return res.json({
      success: true,
      enabled,
      message: `Modern system ${enabled ? 'enabled' : 'disabled'}`
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Failed to set modern system status',
      details: (error as Error).message
    });
  }
});

export default router;