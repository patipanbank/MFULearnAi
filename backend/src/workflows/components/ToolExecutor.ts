import { LoggerService } from '../../services/LoggerService';
import { AGENT_EVENTS, AgentContext } from '../types/AgentTypes';

// ---------------------------------------------------------------------------
// Tool-result compaction helpers
// ---------------------------------------------------------------------------

/**
 * Remove null, undefined, and empty-string values from an object (shallow).
 */
function stripEmpty(obj: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined || v === '') continue;
        out[k] = v;
    }
    return out;
}

/**
 * Convert an array-of-objects into a compact Markdown table.
 * Much more token-efficient than JSON for tabular data.
 *
 * Example:
/**
 * Convert an array-of-objects into ultra-compact delimited format.
 * Header row uses field names, `/` separates fields, `|` separates rows.
 *
 * Example:
 *   id/location/status|CAM-01/หน้าประตู/online|CAM-02/ลานจอดรถ/offline
 */
function arrayToCompact(arr: Record<string, any>[]): string {
    if (arr.length === 0) return '(empty)';

    const keys = Array.from(new Set(arr.flatMap(Object.keys)));
    const header = keys.join('/');
    const rows = arr.map(row =>
        keys.map(k => {
            const v = row[k];
            if (v === null || v === undefined) return '';
            // Escape `/` and `|` inside values to avoid ambiguity
            return String(v).replace(/[/|]/g, '_');
        }).join('/')
    );

    return [header, ...rows].join('|');
}

/**
 * Compact a raw tool result into a token-efficient representation.
 *
 * Strategy (no data is lost):
 *  1. Array of objects → delimited format  (header/row1|row2)
 *  2. Object → strip nulls & compact JSON (no whitespace)
 *  3. String that is JSON → parse then compact
 *  4. Otherwise → return as-is
 */
function compactResult(raw: any): string {
    // Already a string — try to parse it for better formatting
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return compactResult(parsed);
        } catch {
            return raw;
        }
    }

    // Array of objects → compact delimited
    if (Array.isArray(raw)) {
        if (raw.length === 0) return '(empty)';
        if (typeof raw[0] === 'object' && raw[0] !== null) {
            const cleaned = raw.map(item => (typeof item === 'object' ? stripEmpty(item) : item));
            return `${raw.length} results:` + arrayToCompact(cleaned as Record<string, any>[]);
        }
        // Primitive array
        return JSON.stringify(raw);
    }

    // Single object → compact JSON
    if (typeof raw === 'object' && raw !== null) {
        return JSON.stringify(stripEmpty(raw));
    }

    return String(raw);
}

export class ToolExecutor {
    static async executeTools(
        fullResponse: string,
        contentBlocks: any[],
        allowedTools: any[],
        ctx: AgentContext,
        step: number,
        emit: (type: string, payload: any) => void
    ): Promise<{ usedTools: Set<string>, toolResults: any[] }> {
        const toolUseBlocks = contentBlocks && contentBlocks.length > 0
            ? contentBlocks
            : [{ type: 'text', text: fullResponse }];

        const usedTools = new Set<string>();
        const toolResults: any[] = [];

        for (const block of toolUseBlocks) {
            if (block.type !== 'tool_use') continue;

            const { name: toolName, input: toolInput, toolUseId } = block;
            usedTools.add(toolName);

            LoggerService.info('tool_execution', { tool: toolName, input: toolInput }, ctx.userId);

            emit(AGENT_EVENTS.TOOL_START, { toolName, input: toolInput, step });
            emit(AGENT_EVENTS.STATUS, { message: `🔧 Using ${toolName}...` });

            // Execute Tool
            const start = Date.now();
            const tool = allowedTools.find(t => t.schemaJSON.name === toolName);
            let result: any;
            let success = false;

            if (tool) {
                const exec = await tool.execute(toolInput, {
                    userId: ctx.userId,
                    role: ctx.userRole,
                    department: ctx.userDepartment,
                    collectionId: ctx.collectionId,
                    isApiKey: ctx.isApiKey,
                    allowedDepartments: ctx.allowedDepartments,
                    allowedKnowledgeIds: ctx.allowedKnowledgeIds,
                });
                result = exec.success ? exec.result : `Error: ${exec.error}`;
                success = exec.success;
                if (toolName === 'search' && success) usedTools.add('search');
            } else {
                result = `Error: Tool ${toolName} not found.`;
            }

            const duration = Date.now() - start;

            // Compact the result → table / minimal JSON (no data lost, just formatted efficiently)
            const compacted = compactResult(result);
            const originalLen = typeof result === 'string' ? result.length : JSON.stringify(result).length;

            if (originalLen !== compacted.length) {
                LoggerService.info('tool_result_compacted', {
                    tool: toolName,
                    originalChars: originalLen,
                    compactedChars: compacted.length,
                    savings: `${Math.round((1 - compacted.length / originalLen) * 100)}%`
                }, ctx.userId);
            }

            emit(AGENT_EVENTS.TOOL_COMPLETE, {
                toolName,
                success,
                resultPreview: compacted.substring(0, 300),
                durationMs: duration,
                step
            });

            toolResults.push({
                toolUseId,
                content: [{ json: { result: compacted } }]
            });
        }

        return { usedTools, toolResults };
    }
}
