import { Request, Response } from 'express';
import { ToolAccessService } from '../services/ToolAccessService';
import { LoggerService } from '../services/LoggerService';

// Import tool registry to get runtime tools for the summary
import { CalculatorTool } from '../tools/CalculatorTool';
import { SearchTool } from '../tools/SearchTool';
import { PolicyCheckerTool } from '../tools/PolicyCheckerTool';
import { mcpManager } from '../mcp/McpManager';
import { AgentTool } from '../tools/AgentTool';

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
}
