"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const unifiedToolRegistry_1 = require("../services/unifiedToolRegistry");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { sessionId, collectionNames } = req.query;
        const user = req.user;
        const context = {
            sessionId: sessionId,
            userId: user?.username,
            collectionNames: collectionNames ?
                (Array.isArray(collectionNames) ? collectionNames : [collectionNames]) :
                [],
        };
        const availableTools = unifiedToolRegistry_1.unifiedToolRegistry.getAvailableTools(context);
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
    }
    catch (error) {
        console.error('Error fetching tools:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch available tools'
        });
    }
});
router.get('/statistics', auth_1.authenticateJWT, async (req, res) => {
    try {
        const stats = unifiedToolRegistry_1.unifiedToolRegistry.getToolStatistics();
        return res.json({
            success: true,
            statistics: stats
        });
    }
    catch (error) {
        console.error('Error fetching tool statistics:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch tool statistics'
        });
    }
});
router.post('/execute', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { toolId, input, context } = req.body;
        const user = req.user;
        if (!toolId || input === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Tool ID and input are required'
            });
        }
        const executionContext = {
            sessionId: context?.sessionId,
            userId: user?.username,
            collectionNames: context?.collectionNames || [],
            config: context?.config
        };
        const result = await unifiedToolRegistry_1.unifiedToolRegistry.executeTool(toolId, input, executionContext);
        return res.json({
            success: true,
            result: result
        });
    }
    catch (error) {
        console.error('Error executing tool:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to execute tool'
        });
    }
});
router.post('/session/:sessionId/create', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const user = req.user;
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
        }
        const sessionTools = unifiedToolRegistry_1.unifiedToolRegistry.createSessionTools(sessionId);
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
    }
    catch (error) {
        console.error('Error creating session tools:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create session tools'
        });
    }
});
router.delete('/session/:sessionId', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
        }
        unifiedToolRegistry_1.unifiedToolRegistry.cleanupSessionTools(sessionId);
        return res.json({
            success: true,
            message: `Session tools cleaned up for session: ${sessionId}`
        });
    }
    catch (error) {
        console.error('Error cleaning up session tools:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to cleanup session tools'
        });
    }
});
router.post('/collections/create', auth_1.authenticateJWT, async (req, res) => {
    try {
        const { collectionNames } = req.body;
        if (!collectionNames || !Array.isArray(collectionNames)) {
            return res.status(400).json({
                success: false,
                error: 'Collection names array is required'
            });
        }
        const collectionTools = unifiedToolRegistry_1.unifiedToolRegistry.createCollectionTools(collectionNames);
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
    }
    catch (error) {
        console.error('Error creating collection tools:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create collection tools'
        });
    }
});
router.get('/categories', async (req, res) => {
    try {
        const context = {};
        const allTools = unifiedToolRegistry_1.unifiedToolRegistry.getAvailableTools(context);
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
    }
    catch (error) {
        console.error('Error fetching tool categories:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch tool categories'
        });
    }
});
exports.default = router;
//# sourceMappingURL=tools.js.map