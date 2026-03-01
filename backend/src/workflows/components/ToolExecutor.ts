import { LoggerService } from '../../services/LoggerService';
import { AGENT_EVENTS, AgentContext, BedrockContentBlock, ToolResultEntry } from '../types/AgentTypes';
import { AGENT_CONSTANTS, AGENT_MESSAGES } from '../types/AgentConstants';
import { AgentTool, ToolExecutionContext } from '../../tools/AgentTool';

// ---------------------------------------------------------------------------
// Tool-result compaction helpers
// ---------------------------------------------------------------------------

/**
 * Remove null, undefined, and empty-string values from an object (shallow).
 */
function stripEmpty(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === null || v === undefined || v === '') continue;
        out[k] = v;
    }
    return out;
}

/**
 * Convert an array-of-objects into ultra-compact delimited format.
 * Header row uses field names, `/` separates fields, `|` separates rows.
 *
 * Example:
 *   id/location/status|CAM-01/หน้าประตู/online|CAM-02/ลานจอดรถ/offline
 */
function arrayToCompact(arr: Record<string, unknown>[]): string {
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
function compactResult(raw: unknown): string {
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
            const cleaned = raw.map(item => (typeof item === 'object' ? stripEmpty(item as Record<string, unknown>) : item));
            return `${raw.length} results:` + arrayToCompact(cleaned as Record<string, unknown>[]);
        }
        // Primitive array
        return JSON.stringify(raw);
    }

    // Single object → compact JSON
    if (typeof raw === 'object' && raw !== null) {
        return JSON.stringify(stripEmpty(raw as Record<string, unknown>));
    }

    return String(raw);
}

/**
 * Wraps a promise with a timeout. Rejects with a descriptive error if the
 * promise does not resolve within `ms` milliseconds.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`Tool "${label}" timed out after ${ms}ms`)),
            ms
        );
        promise
            .then(val => { clearTimeout(timer); resolve(val); })
            .catch(err => { clearTimeout(timer); reject(err); });
    });
}

/** Result of a single tool invocation (internal) */
interface SingleToolResult {
    toolName: string;
    toolUseId: string;
    result: unknown;
    success: boolean;
    durationMs: number;
}

export class ToolExecutor {
    /**
     * Execute all tool_use blocks requested by the model.
     * Independent tools run in parallel; each call is guarded by a timeout.
     */
    static async executeTools(
        fullResponse: string,
        contentBlocks: BedrockContentBlock[],
        allowedTools: AgentTool[],
        ctx: AgentContext,
        step: number,
        emit: (type: string, payload: Record<string, unknown>) => void
    ): Promise<{ usedTools: Set<string>; toolResults: ToolResultEntry[] }> {
        const toolUseBlocks = contentBlocks && contentBlocks.length > 0
            ? contentBlocks
            : [{ type: 'text', text: fullResponse } as BedrockContentBlock];

        const pendingBlocks = toolUseBlocks.filter(
            (b): b is Extract<BedrockContentBlock, { type: 'tool_use' }> => 'type' in b && b.type === 'tool_use'
        );

        if (pendingBlocks.length === 0) {
            return { usedTools: new Set<string>(), toolResults: [] };
        }

        const usedTools = new Set<string>();
        const timeout = AGENT_CONSTANTS.TOOL_TIMEOUT_MS;

        // Build execution context once
        const execCtx: ToolExecutionContext = {
            userId: ctx.userId,
            role: ctx.userRole,
            department: ctx.userDepartment,
            collectionId: ctx.collectionId,
            isApiKey: ctx.isApiKey,
            allowedDepartments: ctx.allowedDepartments,
            allowedKnowledgeIds: ctx.allowedKnowledgeIds,
        };

        // Emit status for each tool, then run ALL in parallel
        for (const block of pendingBlocks) {
            usedTools.add(block.name);
            emit(AGENT_EVENTS.TOOL_START, { toolName: block.name, input: block.input, step });
            emit(AGENT_EVENTS.STATUS, { message: AGENT_MESSAGES.STATUS_USING_TOOL(block.name) });
        }

        const settled = await Promise.allSettled(
            pendingBlocks.map(block => this.executeSingle(block, allowedTools, execCtx, timeout, ctx.userId))
        );

        // Map results back in order
        const toolResults: ToolResultEntry[] = [];

        for (let i = 0; i < pendingBlocks.length; i++) {
            const block = pendingBlocks[i];
            const outcome = settled[i];

            let singleResult: SingleToolResult;

            if (outcome.status === 'fulfilled') {
                singleResult = outcome.value;
            } else {
                // Should not happen (executeSingle catches internally), but safety net
                singleResult = {
                    toolName: block.name,
                    toolUseId: block.toolUseId,
                    result: `Error: ${outcome.reason?.message || 'Unknown error'}`,
                    success: false,
                    durationMs: 0
                };
            }

            // Compact the result
            const compacted = compactResult(singleResult.result);
            const originalLen = typeof singleResult.result === 'string'
                ? singleResult.result.length
                : JSON.stringify(singleResult.result).length;

            if (originalLen !== compacted.length) {
                LoggerService.info('tool_result_compacted', {
                    tool: singleResult.toolName,
                    originalChars: originalLen,
                    compactedChars: compacted.length,
                    savings: `${Math.round((1 - compacted.length / originalLen) * 100)}%`
                }, ctx.userId);
            }

            emit(AGENT_EVENTS.TOOL_COMPLETE, {
                toolName: singleResult.toolName,
                success: singleResult.success,
                resultPreview: compacted.substring(0, AGENT_CONSTANTS.RESULT_PREVIEW_CHARS),
                durationMs: singleResult.durationMs,
                step
            });

            toolResults.push({
                toolUseId: singleResult.toolUseId,
                content: [{ json: { result: compacted } }]
            });
        }

        return { usedTools, toolResults };
    }

    /**
     * Execute a single tool with timeout guard.
     * Never throws — returns an error result on failure.
     */
    private static async executeSingle(
        block: { toolUseId: string; name: string; input: Record<string, unknown> },
        allowedTools: AgentTool[],
        execCtx: ToolExecutionContext,
        timeoutMs: number,
        userId: string
    ): Promise<SingleToolResult> {
        const start = Date.now();
        const tool = allowedTools.find(t => t.schemaJSON.name === block.name);

        if (!tool) {
            return {
                toolName: block.name,
                toolUseId: block.toolUseId,
                result: `Error: Tool "${block.name}" not found.`,
                success: false,
                durationMs: Date.now() - start
            };
        }

        try {
            LoggerService.info('tool_execution', { tool: block.name, input: block.input }, userId);

            const exec = await withTimeout(
                tool.execute(block.input, execCtx),
                timeoutMs,
                block.name
            );

            return {
                toolName: block.name,
                toolUseId: block.toolUseId,
                result: exec.success ? exec.result : `Error: ${exec.error}`,
                success: exec.success,
                durationMs: Date.now() - start
            };
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            LoggerService.error('tool_execution_error', {
                tool: block.name,
                error: message
            }, userId);

            return {
                toolName: block.name,
                toolUseId: block.toolUseId,
                result: `Error: ${message}`,
                success: false,
                durationMs: Date.now() - start
            };
        }
    }
}
