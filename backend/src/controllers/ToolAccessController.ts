import { Request, Response } from 'express';
import { ToolAccessService } from '../services/ToolAccessService';
import { LoggerService } from '../services/LoggerService';

// Import tool registry to get runtime tools for the summary
import { CalculatorTool } from '../tools/CalculatorTool';
import { SearchTool } from '../tools/SearchTool';
import { PolicyCheckerTool } from '../tools/PolicyCheckerTool';
import { mcpManager } from '../mcp/McpManager';
import { AgentTool } from '../tools/AgentTool';

// Enterprise infrastructure imports
import { CircuitBreaker } from '../infra/circuit-breaker';
import { ToolRateLimiter } from '../infra/rate-limiter';

/** All known built-in tools. Must stay in sync with AgentWorkflow's AVAILABLE_TOOLS. */
const BUILTIN_TOOLS: AgentTool[] = [
    new CalculatorTool(),
    new SearchTool(),
    new PolicyCheckerTool()
];

/** Valid roles for tool access assignment */
const VALID_ROLES = ['*', 'student', 'staff', 'admin', 'superadmin'];

export class ToolAccessController {

    /**
     * GET /api/tools/access
     * Returns all tools (runtime + DB) with their effective access config.
     * Used by the superadmin UI to show the full management grid.
     */
    static async getAll(req: any, res: Response) {
        try {
            const allTools = [...BUILTIN_TOOLS, ...mcpManager.getTools()];
            const summary = await ToolAccessService.getAccessSummary(allTools);

            res.json({
                tools: summary,
                availableRoles: VALID_ROLES
            });
        } catch (error: any) {
            LoggerService.error('tool_access_get_all_error', { error: error.message });
            res.status(500).json({ error: 'Failed to fetch tool access config' });
        }
    }

    /**
     * PUT /api/tools/access/:toolName
     * Update access config for a specific tool.
     * Body: { allowedRoles: string[], isDisabled?: boolean, description?: string }
     */
    static async update(req: any, res: Response) {
        try {
            const { toolName } = req.params;
            const { allowedRoles, isDisabled, description } = req.body;

            // Validation
            if (!toolName || typeof toolName !== 'string') {
                return res.status(400).json({ error: 'toolName is required' });
            }

            if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
                return res.status(400).json({ error: 'allowedRoles must be a non-empty array' });
            }

            // Validate each role
            const invalidRoles = allowedRoles.filter((r: string) => !VALID_ROLES.includes(r));
            if (invalidRoles.length > 0) {
                return res.status(400).json({
                    error: `Invalid roles: ${invalidRoles.join(', ')}. Valid: ${VALID_ROLES.join(', ')}`
                });
            }

            // Determine tool source
            const allTools = [...BUILTIN_TOOLS, ...mcpManager.getTools()];
            const tool = allTools.find(t => t.name === toolName);
            const source = tool
                ? (BUILTIN_TOOLS.some(b => b.name === toolName) ? 'builtin' : 'mcp')
                : 'builtin'; // Default for unknown tools

            const updatedBy = req.user?.userId || 'unknown';

            const doc = await ToolAccessService.updateAccess(
                toolName,
                allowedRoles,
                isDisabled ?? false,
                description ?? tool?.description ?? '',
                source as 'builtin' | 'mcp',
                updatedBy
            );

            res.json({
                success: true,
                config: {
                    toolName: doc.toolName,
                    allowedRoles: doc.allowedRoles,
                    isDisabled: doc.isDisabled,
                    description: doc.description,
                    source: doc.source,
                    updatedBy: doc.updatedBy,
                    updatedAt: doc.updatedAt
                }
            });
        } catch (error: any) {
            LoggerService.error('tool_access_update_error', { error: error.message });
            res.status(500).json({ error: 'Failed to update tool access config' });
        }
    }

    /**
     * DELETE /api/tools/access/:toolName
     * Reset a tool to its code defaults (remove DB override).
     */
    static async reset(req: any, res: Response) {
        try {
            const { toolName } = req.params;

            if (!toolName) {
                return res.status(400).json({ error: 'toolName is required' });
            }

            const updatedBy = req.user?.userId || 'unknown';
            await ToolAccessService.resetToDefault(toolName, updatedBy);

            res.json({ success: true, message: `${toolName} reset to code defaults` });
        } catch (error: any) {
            LoggerService.error('tool_access_reset_error', { error: error.message });
            res.status(500).json({ error: 'Failed to reset tool access config' });
        }
    }

    /* =====================================================================
     * TOOL DISCOVERY — public API for clients to enumerate available tools
     * ===================================================================== */

    /**
     * GET /api/tools/discovery
     * Returns all available tools with their schemas, versions, and health status.
     * Suitable for API consumers and developer documentation.
     */
    static async discovery(_req: any, res: Response) {
        try {
            const allTools = [...BUILTIN_TOOLS, ...mcpManager.getTools()];
            const cbStatus = CircuitBreaker.getAllStatus();

            const catalog = allTools.map(tool => {
                const cb = cbStatus.find(s => s.toolName === tool.name);
                return {
                    name: tool.name,
                    description: tool.description,
                    version: tool.version ?? '1.0.0',
                    source: BUILTIN_TOOLS.some(b => b.name === tool.name) ? 'builtin' : 'mcp',
                    inputSchema: tool.schemaJSON?.inputSchema ?? null,
                    degradationPolicy: tool.degradationPolicy ?? 'error',
                    health: {
                        circuitState: cb?.state ?? 'CLOSED',
                        failureCount: cb?.failureCount ?? 0,
                    },
                };
            });

            res.json({
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                totalTools: catalog.length,
                tools: catalog,
            });
        } catch (error: any) {
            LoggerService.error('tool_discovery_error', { error: error.message });
            res.status(500).json({ error: 'Failed to generate tool catalog' });
        }
    }

    /* =====================================================================
     * CIRCUIT BREAKER — admin endpoints to inspect & manage circuit state
     * ===================================================================== */

    /**
     * GET /api/tools/circuit-breaker
     * Returns circuit breaker status for every tool.
     */
    static async circuitBreakerStatus(_req: any, res: Response) {
        try {
            const statuses = CircuitBreaker.getAllStatus();
            res.json({ statuses });
        } catch (error: any) {
            LoggerService.error('circuit_breaker_status_error', { error: error.message });
            res.status(500).json({ error: 'Failed to fetch circuit breaker status' });
        }
    }

    /**
     * POST /api/tools/circuit-breaker/:toolName/reset
     * Manually reset a tripped circuit breaker (admin override).
     */
    static async circuitBreakerReset(req: any, res: Response) {
        try {
            const { toolName } = req.params;
            if (!toolName) {
                return res.status(400).json({ error: 'toolName is required' });
            }

            CircuitBreaker.reset(toolName);
            LoggerService.info('circuit_breaker_manual_reset', {
                toolName,
                resetBy: req.user?.userId || 'unknown',
            });

            res.json({ success: true, message: `Circuit breaker for ${toolName} reset to CLOSED` });
        } catch (error: any) {
            LoggerService.error('circuit_breaker_reset_error', { error: error.message });
            res.status(500).json({ error: 'Failed to reset circuit breaker' });
        }
    }

    /* =====================================================================
     * RATE LIMITER — admin endpoint to inspect current usage windows
     * ===================================================================== */

    /**
     * GET /api/tools/rate-limit/stats
     * Returns rate limiter configuration (does not expose per-user windows).
     */
    static async rateLimitStats(_req: any, res: Response) {
        try {
            const config = ToolRateLimiter.getConfig();
            res.json({ config });
        } catch (error: any) {
            LoggerService.error('rate_limit_stats_error', { error: error.message });
            res.status(500).json({ error: 'Failed to fetch rate limit stats' });
        }
    }
}
