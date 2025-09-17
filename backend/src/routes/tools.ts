/**
 * 🔧 Tool Management API Routes
 *
 * API endpoints สำหรับจัดการ tools ในระบบ
 * - ดู tools ที่มีอยู่
 * - สถิติการใช้งาน tools
 * - จัดการ session tools
 */

import { Router, Request, Response } from 'express';
import { unifiedToolRegistry, ToolExecutionContext } from '../services/unifiedToolRegistry';
import { authenticateJWT } from '../middleware/auth';

const router = Router();

/**
 * GET /api/tools
 * Get available tools for current user/session
 */
router.get('/', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { sessionId, collectionNames } = req.query;
    const user = (req as any).user;

    const context: ToolExecutionContext = {
      sessionId: sessionId as string,
      userId: user?.username,
      collectionNames: collectionNames ?
        (Array.isArray(collectionNames) ? collectionNames as string[] : [collectionNames as string]) :
        [],
    };

    const availableTools = unifiedToolRegistry.getAvailableTools(context);

    // Format tools for frontend
    const formattedTools = availableTools.map(tool => ({
      id: tool.id,
      name: tool.name,
      description: tool.description,
      category: tool.category,
      type: tool.type,
      enabled: tool.enabled,
      version: tool.version,
      tags: tool.metadata.tags,
      examples: tool.metadata.examples,
      usageCount: tool.metadata.usage_count,
      performance: tool.metadata.performance
    }));

    return res.json({
      success: true,
      tools: formattedTools,
      context: {
        sessionId: context.sessionId,
        userId: context.userId,
        collectionCount: context.collectionNames?.length || 0
      }
    });

  } catch (error) {
    console.error('Error fetching tools:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch available tools'
    });
  }
});

/**
 * GET /api/tools/statistics
 * Get tool usage statistics
 */
router.get('/statistics', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const stats = unifiedToolRegistry.getToolStatistics();

    return res.json({
      success: true,
      statistics: stats
    });

  } catch (error) {
    console.error('Error fetching tool statistics:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tool statistics'
    });
  }
});

/**
 * POST /api/tools/execute
 * Execute a specific tool (for testing/debugging)
 */
router.post('/execute', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { toolId, input, context } = req.body;
    const user = (req as any).user;

    if (!toolId || input === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Tool ID and input are required'
      });
    }

    const executionContext: ToolExecutionContext = {
      sessionId: context?.sessionId,
      userId: user?.username,
      collectionNames: context?.collectionNames || [],
      config: context?.config
    };

    const result = await unifiedToolRegistry.executeTool(toolId, input, executionContext);

    return res.json({
      success: true,
      result: result
    });

  } catch (error) {
    console.error('Error executing tool:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to execute tool'
    });
  }
});

/**
 * POST /api/tools/session/:sessionId/create
 * Create session-specific tools
 */
router.post('/session/:sessionId/create', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const user = (req as any).user;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    const sessionTools = unifiedToolRegistry.createSessionTools(sessionId);

    return res.json({
      success: true,
      sessionId,
      toolsCreated: sessionTools.length,
      tools: sessionTools.map(tool => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        type: tool.type
      }))
    });

  } catch (error) {
    console.error('Error creating session tools:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create session tools'
    });
  }
});

/**
 * DELETE /api/tools/session/:sessionId
 * Cleanup session-specific tools
 */
router.delete('/session/:sessionId', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }

    unifiedToolRegistry.cleanupSessionTools(sessionId);

    return res.json({
      success: true,
      message: `Session tools cleaned up for session: ${sessionId}`
    });

  } catch (error) {
    console.error('Error cleaning up session tools:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to cleanup session tools'
    });
  }
});

/**
 * POST /api/tools/collections/create
 * Create collection-specific search tools
 */
router.post('/collections/create', authenticateJWT, async (req: Request, res: Response) => {
  try {
    const { collectionNames } = req.body;

    if (!collectionNames || !Array.isArray(collectionNames)) {
      return res.status(400).json({
        success: false,
        error: 'Collection names array is required'
      });
    }

    const collectionTools = unifiedToolRegistry.createCollectionTools(collectionNames);

    return res.json({
      success: true,
      collections: collectionNames,
      toolsCreated: collectionTools.length,
      tools: collectionTools.map(tool => ({
        id: tool.id,
        name: tool.name,
        description: tool.description,
        type: tool.type
      }))
    });

  } catch (error) {
    console.error('Error creating collection tools:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create collection tools'
    });
  }
});

/**
 * GET /api/tools/categories
 * Get available tool categories
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const context: ToolExecutionContext = {};
    const allTools = unifiedToolRegistry.getAvailableTools(context);

    const categories = [...new Set(allTools.map(tool => tool.category))];
    const categoriesWithCounts = categories.map(category => ({
      name: category,
      count: allTools.filter(tool => tool.category === category).length,
      tools: allTools
        .filter(tool => tool.category === category)
        .map(tool => ({
          id: tool.id,
          name: tool.name,
          description: tool.description,
          enabled: tool.enabled
        }))
    }));

    return res.json({
      success: true,
      categories: categoriesWithCounts
    });

  } catch (error) {
    console.error('Error fetching tool categories:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tool categories'
    });
  }
});

export default router;