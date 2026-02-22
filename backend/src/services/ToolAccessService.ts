import ToolAccessConfig, { ToolAccessConfigDocument } from '../models/ToolAccessConfig';
import { LoggerService } from './LoggerService';
import { AgentTool } from '../tools/AgentTool';

/**
 * ToolAccessService — Runtime authority for tool-role access decisions.
 *
 * Architecture:
 *   Code-First, DB-Override with in-memory cache.
 *   1. Tools define `allowedRoles` in code (the defaults).
 *   2. Superadmins can override via DB through the admin UI.
 *   3. This service caches DB overrides and resolves access checks.
 *   4. New tools auto-appear — no config entry required.
 *
 * Cache Strategy:
 *   - In-memory Map, refreshed every CACHE_TTL_MS or on explicit invalidate().
 *   - Single-instance safe (no multi-pod concerns for this project).
 */

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedConfig {
    allowedRoles: string[];
    isDisabled: boolean;
}

export class ToolAccessService {
    private static cache: Map<string, CachedConfig> = new Map();
    private static lastRefresh: number = 0;

    /**
     * Check if a tool is allowed for the given role.
     * Priority: DB override > tool's hardcoded `allowedRoles`.
     */
    static async isAllowed(tool: AgentTool, userRole: string): Promise<boolean> {
        await this.ensureCache();

        const dbConfig = this.cache.get(tool.name);

        // DB override exists
        if (dbConfig) {
            if (dbConfig.isDisabled) return false;
            return dbConfig.allowedRoles.includes(userRole) || dbConfig.allowedRoles.includes('*');
        }

        // No DB override — use tool's hardcoded defaults
        return tool.isAllowed(userRole);
    }

    /**
     * Filter an array of tools to only those allowed for the given role.
     * Used by AgentWorkflow before the agent loop.
     */
    static async filterAllowed(tools: AgentTool[], userRole: string): Promise<AgentTool[]> {
        await this.ensureCache();

        return tools.filter(tool => {
            const dbConfig = this.cache.get(tool.name);

            if (dbConfig) {
                if (dbConfig.isDisabled) return false;
                return dbConfig.allowedRoles.includes(userRole) || dbConfig.allowedRoles.includes('*');
            }

            return tool.isAllowed(userRole);
        });
    }

    /**
     * Get full tool access summary for admin UI.
     * Merges runtime tools with DB configs to show everything in one view.
     */
    static async getAccessSummary(runtimeTools: AgentTool[]): Promise<Array<{
        toolName: string;
        description: string;
        source: 'builtin' | 'mcp';
        allowedRoles: string[];
        isDisabled: boolean;
        hasDbOverride: boolean;
    }>> {
        await this.ensureCache();

        // Load DB configs for metadata (description, updatedBy, etc.)
        const dbConfigs = await ToolAccessConfig.find({}).lean();
        const dbMap = new Map(dbConfigs.map(c => [c.toolName, c]));

        const result = runtimeTools.map(tool => {
            const dbConfig = dbMap.get(tool.name);
            const isMcp = !['calculator', 'search', 'check_policy'].includes(tool.name);

            return {
                toolName: tool.name,
                description: dbConfig?.description || tool.description,
                source: (dbConfig?.source || (isMcp ? 'mcp' : 'builtin')) as 'builtin' | 'mcp',
                allowedRoles: dbConfig ? dbConfig.allowedRoles : tool.allowedRoles,
                isDisabled: dbConfig?.isDisabled ?? false,
                hasDbOverride: !!dbConfig
            };
        });

        // Include DB-only entries (tools that were configured but no longer in runtime — orphaned)
        for (const [toolName, dbConfig] of dbMap.entries()) {
            if (!result.some(r => r.toolName === toolName)) {
                result.push({
                    toolName,
                    description: dbConfig.description || '(Tool not currently loaded)',
                    source: dbConfig.source as 'builtin' | 'mcp',
                    allowedRoles: dbConfig.allowedRoles,
                    isDisabled: true, // Mark as disabled since not in runtime
                    hasDbOverride: true
                });
            }
        }

        return result;
    }

    /**
     * Update access config for a tool (superadmin action).
     */
    static async updateAccess(
        toolName: string,
        allowedRoles: string[],
        isDisabled: boolean,
        description: string,
        source: 'builtin' | 'mcp',
        updatedBy: string
    ): Promise<ToolAccessConfigDocument> {
        const doc = await ToolAccessConfig.findOneAndUpdate(
            { toolName },
            {
                $set: {
                    allowedRoles,
                    isDisabled,
                    description,
                    source,
                    updatedBy
                }
            },
            { upsert: true, new: true }
        );

        // Invalidate cache immediately so the change takes effect
        this.invalidate();

        LoggerService.audit('tool_access_updated', {
            toolName,
            allowedRoles,
            isDisabled,
            updatedBy
        });

        return doc;
    }

    /**
     * Reset a tool to its code defaults by removing the DB override.
     */
    static async resetToDefault(toolName: string, updatedBy: string): Promise<void> {
        await ToolAccessConfig.deleteOne({ toolName });
        this.invalidate();

        LoggerService.audit('tool_access_reset', { toolName, updatedBy });
    }

    /**
     * Force cache refresh on next access check.
     */
    static invalidate(): void {
        this.lastRefresh = 0;
        this.cache.clear();
    }

    /**
     * Ensure cache is fresh. Lazy-loads from DB on first call or after TTL expiry.
     */
    private static async ensureCache(): Promise<void> {
        const now = Date.now();
        if (now - this.lastRefresh < CACHE_TTL_MS && this.cache.size > 0) return;

        try {
            const configs = await ToolAccessConfig.find({}).lean();

            this.cache.clear();
            for (const config of configs) {
                this.cache.set(config.toolName, {
                    allowedRoles: config.allowedRoles,
                    isDisabled: config.isDisabled
                });
            }
            this.lastRefresh = now;
        } catch (error) {
            LoggerService.error('tool_access_cache_refresh_failed', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            // On DB failure, don't clear cache — stale data is better than no data
        }
    }
}
