import { Request, Response } from 'express';
import { HistoryService } from '../services/HistoryService';
import { KnowledgeService } from '../services/KnowledgeService';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { SummarizationService } from '../services/SummarizationService';
import { CalculatorTool } from '../tools/CalculatorTool';

const MAX_STEPS = 5;

// Whitelist of tools for the Agent
const AVAILABLE_TOOLS = [
    new CalculatorTool()
];

export class AgentWorkflow {
    static async run(req: Request, res: Response) {
        const { userId, message, sessionId, collectionId, userRole, userDepartment } = (req as any).userContext;
        const query = message;
        const traceId = crypto.randomUUID();

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        LoggerService.info('agent_workflow_start', { traceId, userId, message }, userId);

        try {
            // 1.1 Load History + Smart Context (Agent Memory)
            const { messages: history, smartContext } = await HistoryService.getContext(userId, sessionId);

            // 1.2 RAG Search (Gated by Intent + Fast Re-check)
            const userContext = { userId, role: userRole, department: userDepartment };
            const rollingIntent = smartContext?.rolling?.intent;
            let currentIntent = typeof rollingIntent === 'string' ? rollingIntent : (rollingIntent?.primary || 'QUERY');

            // Fast Intent Re-check (Haiku) to mitigate "Lag Risk"
            if (currentIntent === 'CHITCHAT' || currentIntent === 'QUERY') {
                const fastIntent = await this.quickIntentCheck(query);
                if (fastIntent !== currentIntent) {
                    LoggerService.info('agent_intent_corrected', { old: currentIntent, new: fastIntent, traceId }, userId);
                    currentIntent = fastIntent;
                }
            }

            const RAG_INTENTS = ['FACT_LOOKUP', 'RESEARCH', 'DEBUGGING', 'DESIGN'];
            const shouldUseRAG = RAG_INTENTS.includes(currentIntent);

            let ragContext = '';
            if (shouldUseRAG) {
                ragContext = await KnowledgeService.search(query, userContext, collectionId, currentIntent);
                LoggerService.info('agent_rag_result', { found: !!ragContext, intent: currentIntent, traceId }, userId);
            }

            const ragSystemPrompt = ragContext
                ? `\n\n=== KNOWLEDGE BASE CONTEXT ===\n${ragContext}\n==============================\nUse this context to answer the user's question if relevant.`
                : '';

            // 1.3 Tools Preparation
            const allowedTools = AVAILABLE_TOOLS.filter(t => t.isAllowed(userRole));
            const toolsPrompt = allowedTools.length > 0
                ? `\n\nYou have access to the following tools:\n${allowedTools.map(t => `${t.name}: ${t.description}`).join('\n')}\n\nTo use a tool, wrap the JSON call in <tool_use> tags. Example: <tool_use>{"tool": "search", "parameters": {"q": "AI"}}</tool_use>`
                : '';

            // 1.4 Construct Initial Prompt
            let messages: any[] = [
                {
                    role: 'system' as const,
                    content: `You are the MFU Learn AI Agent. You are efficient and helpful.
                    
=== CANONICAL MEMORY (Established Facts) ===
${smartContext?.canonical || 'First session.'}

=== ROLLING CONTEXT (Recent Intent & Decisions) ===
${JSON.stringify(smartContext?.rolling || {}, null, 2)}

${ragSystemPrompt}
${toolsPrompt}

If you need to use a tool to answer, use it. If you have the answer, reply directly to the user.
`
                },
                ...history.slice(-10), // Last 10 messages for immediate context
                { role: 'user', content: query }
            ];

            let steps = 0;
            let finalAnswer = '';
            let lastToolCall = '';

            while (steps < MAX_STEPS) {
                steps++;
                LoggerService.info('agent_step', { step: steps, sessionId, traceId }, userId);

                // Call Model (Non-Streaming for internal reasoning)
                let fullResponse = '';
                await new Promise<void>(resolve => {
                    const mockRes: any = {
                        write: (chunk: any) => {
                            if (chunk.startsWith('data: ')) {
                                const d = chunk.replace('data: ', '').trim();
                                if (d === '[DONE]') return;
                                try {
                                    const j = JSON.parse(d);
                                    if (j.text) fullResponse += j.text;
                                } catch (e) { }
                            }
                        },
                        end: () => resolve()
                    };
                    BedrockService.streamChat(messages, 'anthropic.claude-3-5-sonnet-20240620-v1:0', mockRes, async () => { });
                });

                // 2. Parse Tool Use (Robust Regex)
                const toolRegex = /<tool_use>([\s\S]*?)<\/tool_use>/;
                const match = fullResponse.match(toolRegex);

                if (!match) {
                    if (!fullResponse.trim()) {
                        LoggerService.warn('agent_empty_response', { step: steps, traceId }, userId);
                        finalAnswer = "I'm sorry, I couldn't formulate a response. Please try again.";
                    } else {
                        finalAnswer = fullResponse;
                    }
                    break;
                }

                // Tool Use Detected
                let toolCall;
                try {
                    const rawJson = match[1].trim();
                    toolCall = JSON.parse(rawJson);
                } catch (e) {
                    LoggerService.error('agent_tool_parse_error', { step: steps, raw: match[1], traceId }, userId);
                    messages.push({ role: 'assistant', content: fullResponse });
                    messages.push({ role: 'user', content: "Error: Your tool_use JSON was malformed. Please try again with valid JSON." });
                    continue;
                }

                // Loop Kill-Switch: If agent calls the SAME tool with SAME params twice, break.
                const currentCall = `${toolCall.tool}:${JSON.stringify(toolCall.parameters)}`;
                if (currentCall === lastToolCall) {
                    LoggerService.warn('agent_loop_detected', { currentCall, traceId }, userId);
                    finalAnswer = "I've detected a repetitive tool loop. Here is the last known output prior to the loop: " + fullResponse.replace(/<tool_use>[\s\S]*?<\/tool_use>/g, '').trim();
                    break;
                }
                lastToolCall = currentCall;

                const tool = allowedTools.find(t => t.name === toolCall.tool);
                if (!tool) {
                    messages.push({ role: 'assistant', content: fullResponse });
                    messages.push({ role: 'user', content: `Error: Tool '${toolCall.tool}' not found or not allowed.` });
                    continue;
                }

                const toolRoll = { tool: toolCall.tool, parameters: toolCall.parameters };
                LoggerService.info('tool_execution', toolRoll, userId);
                res.write(`data: ${JSON.stringify({ type: 'status', message: `Executing tool: ${toolCall.tool}` })}\n\n`);

                const executionResult = await tool.execute(toolCall.parameters, { userId, role: userRole });

                // 4. Build Result (Sanitized)
                const safeOutput = JSON.stringify(executionResult.result || executionResult.error).replace(/<\/tool_result>/g, '&lt;/tool_result&gt;');
                const resultBlock = `\n<tool_result>\n<tool_name>${toolCall.tool}</tool_name>\n<status>${executionResult.success ? 'success' : 'error'}</status>\n<output>${safeOutput}</output>\n</tool_result>\n`;

                messages.push({ role: 'assistant' as const, content: fullResponse });
                messages.push({ role: 'user' as const, content: resultBlock });

                // 5. History Pruning (Keep memory light during loop)
                if (messages.length > 10) {
                    const systemMsg = messages[0];
                    const recentMsgs = messages.slice(-4);
                    messages = [systemMsg, ...recentMsgs];
                    LoggerService.info('agent_history_pruned', { size: messages.length }, userId);
                }
            }

            // 6. Streaming Final Answer (Cleaned)
            if (finalAnswer) {
                const cleanedAnswer = finalAnswer.replace(/<tool_use>[\s\S]*?<\/tool_use>/g, '').trim();
                res.write(`data: ${JSON.stringify({ text: cleanedAnswer, traceId })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();

                // 7. Background Summarization
                SummarizationService.runUpdate(userId, sessionId, [{ role: 'user', content: query }, { role: 'assistant', content: cleanedAnswer }], smartContext);
            }

        } catch (error: any) {
            LoggerService.error('Agent Workflow Error', { error: error.message, stack: error.stack, traceId });
            res.write(`data: ${JSON.stringify({ error: 'Agent workflow failed', traceId })}\n\n`);
            res.end();
        }
    }

    private static async quickIntentCheck(query: string): Promise<string> {
        try {
            const prompt = `Classify user intent for: "${query}"
            Options: FACT_LOOKUP, RESEARCH, DEBUGGING, DESIGN, CHITCHAT, QUERY.
            Output ONLY the enum value in <intent></intent> tags.`;

            const response = await BedrockService.sendChat('anthropic.claude-3-haiku-20240307-v1:0', [{ role: 'user', content: prompt }], '', 0.1);
            const match = response.match(/<intent>(.*?)<\/intent>/);
            return match ? match[1].trim() : 'QUERY';
        } catch {
            return 'QUERY';
        }
    }
}
