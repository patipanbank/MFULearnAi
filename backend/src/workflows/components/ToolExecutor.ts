import { LoggerService } from '../../services/LoggerService';
import { AGENT_EVENTS, AgentContext } from '../types/AgentTypes';

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
            if (!block || block.type !== 'tool_use') continue;

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
                    collectionId: ctx.collectionId
                });
                result = exec.success ? exec.result : `Error: ${exec.error}`;
                success = exec.success;
                if (toolName === 'search' && success) usedTools.add('search');
            } else {
                result = `Error: Tool ${toolName} not found.`;
            }

            const duration = Date.now() - start;
            emit(AGENT_EVENTS.TOOL_COMPLETE, {
                toolName,
                success,
                resultPreview: typeof result === 'string' ? result.substring(0, 300) : JSON.stringify(result).substring(0, 300),
                durationMs: duration,
                step
            });

            toolResults.push({
                toolUseId,
                content: [{ json: { result } }]
            });
        }

        return { usedTools, toolResults };
    }
}
