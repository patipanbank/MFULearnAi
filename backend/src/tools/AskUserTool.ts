import { AgentTool, ToolExecutionContext, ToolResult, ToolSchemaJSON } from './AgentTool';

/**
 * AskUserTool — Allows the LLM to explicitly ask the user for clarification
 * instead of guessing missing or ambiguous parameters.
 *
 * Why this exists:
 *   Nova (and weaker models) tend to GUESS parameter values when information
 *   is insufficient. This leads to wrong tool calls and irrelevant results.
 *   By giving the model a structured way to say "I don't know, let me ask",
 *   we dramatically reduce hallucinated arguments.
 *
 * How it works:
 *   1. LLM calls ask_user with a question + reason
 *   2. ToolExecutor runs this tool → returns a formatted clarification message
 *   3. The message goes back to the LLM as a tool_result
 *   4. LLM sees the clarification result → generates a text response asking the user
 *   5. User answers → next turn, LLM has the info to call the real tool
 *
 * This is NOT a real "tool" — it doesn't call any external service.
 * It's a structured escape hatch for the LLM to pause and ask questions.
 */
export class AskUserTool extends AgentTool {
    name = 'ask_user';
    description = 'Ask the user a clarifying question when you lack information needed to call another tool. Use this INSTEAD of guessing parameter values.';
    allowedRoles = ['*'];

    schemaJSON: ToolSchemaJSON = {
        name: 'ask_user',
        description: 'Ask the user for missing information before calling another tool. Use when the query is ambiguous or lacks required details.',
        inputSchema: {
            json: {
                type: 'object',
                properties: {
                    question: {
                        type: 'string',
                        description: 'The clarifying question to ask the user, in the same language as their message.',
                        minLength: 5,
                        maxLength: 500,
                    },
                    reason: {
                        type: 'string',
                        description: 'Brief reason why clarification is needed (e.g. "ผู้ใช้ไม่ได้ระบุช่วงเวลา").',
                        maxLength: 200,
                    },
                    missing_fields: {
                        type: 'array',
                        description: 'List of parameter names that are missing or unclear.',
                        items: { type: 'string' },
                    },
                },
                required: ['question'],
                additionalProperties: false,
            }
        }
    };

    /** No degradation needed — this tool is trivial and never fails. */
    degradationPolicy: 'error' | 'fallback' | 'skip' | 'retry_with_default' = 'skip';

    async execute(args: Record<string, unknown>, _context: ToolExecutionContext): Promise<ToolResult> {
        const question = String(args.question || '').trim();
        const reason = args.reason ? String(args.reason).trim() : undefined;
        const missingFields = Array.isArray(args.missing_fields)
            ? args.missing_fields.map(String)
            : [];

        if (!question) {
            return { success: false, result: null, error: 'Question is required.' };
        }

        // Build a structured response that the LLM will use to formulate its text reply
        const parts: string[] = [
            `CLARIFICATION_NEEDED`,
            `Question: ${question}`,
        ];
        if (reason) parts.push(`Reason: ${reason}`);
        if (missingFields.length > 0) parts.push(`Missing: ${missingFields.join(', ')}`);
        parts.push(`Action: Ask this question to the user in your response. Do NOT call any other tool until the user answers.`);

        return {
            success: true,
            result: parts.join('\n'),
        };
    }
}
