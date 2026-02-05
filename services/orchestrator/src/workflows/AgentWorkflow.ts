import { Request, Response } from 'express';
import { HistoryService } from '../services/HistoryService';
import { KnowledgeService } from '../services/KnowledgeService';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { SummarizationService } from '../services/SummarizationService';
import { CalculatorTool } from '../tools/CalculatorTool';
import { SearchTool } from '../tools/SearchTool';

const MAX_STEPS = 5;

// Whitelist of tools for the Agent
const AVAILABLE_TOOLS = [
    new CalculatorTool(),
    new SearchTool()
];

export class AgentWorkflow {
    static async run(req: Request, res: Response) {
        const { userId, message, sessionId, collectionId, userRole, userDepartment } = (req as any).userContext;
        return this.execute(userId, sessionId, message, userRole, userDepartment, collectionId, res);
    }

    static async execute(
        userId: string,
        sessionId: string,
        message: string,
        userRole: string,
        userDepartment: string,
        collectionId: string | undefined,
        res: Response
    ) {
        const query = message;
        const traceId = (global as any).crypto ? (global as any).crypto.randomUUID() : require('crypto').randomUUID();

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

            // Fast Intent Re-check (Haiku) with Context
            if (currentIntent === 'CHITCHAT' || currentIntent === 'QUERY') {
                const intentContext = {
                    last_intent: smartContext?.rolling?.intent?.primary || 'QUERY',
                    last_decisions: smartContext?.rolling?.decisions || [],
                    constraints: smartContext?.rolling?.constraints || []
                };
                const fastIntent = await this.quickIntentCheck(query, intentContext);
                if (fastIntent !== currentIntent) {
                    LoggerService.info('agent_intent_corrected', { old: currentIntent, new: fastIntent, traceId }, userId);
                    currentIntent = fastIntent;
                }
            }

            const RAG_INTENTS = ['FACT_LOOKUP', 'RESEARCH', 'DEBUGGING', 'DESIGN', 'QUERY'];

            // Heuristic RAG Gating: Intent + Complexity Check (Improved for Thai)
            const queryComplexity = query.split(/\s+/).length >= 3 || query.length > 15 || /[\?\.!]/.test(query);
            const hasDomainKeywords = /MFU|system|architecture|security|JWT|canonical|rolling|memory|promotion|auth|Phitsanuruk|พิษณุรักษ์|คู่มือ|สิทธิ์|วิจัย|ค้นหา/i.test(query);

            // Relaxed Rule: Trigger RAG if:
            // 1. Intent is explicitly factual (FACT_LOOKUP, RESEARCH)
            // 2. A specific collection is selected AND intent is not social (CHITCHAT)
            // 3. Query matches RAG intents AND (is complex OR has keywords)
            const shouldUseRAG = (currentIntent === 'FACT_LOOKUP' || currentIntent === 'RESEARCH') ||
                (collectionId && currentIntent !== 'CHITCHAT') ||
                (RAG_INTENTS.includes(currentIntent) && (queryComplexity || hasDomainKeywords));
            let ragContext = '';
            let ragSources: Array<{ id: string, name: string }> = [];
            if (shouldUseRAG) {
                res.write(`data: ${JSON.stringify({ type: 'intent', intent: currentIntent })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'status', message: 'Searching Knowledge Base...' })}\n\n`);
                const searchResult = await KnowledgeService.search(query, userContext, collectionId, currentIntent);
                ragContext = searchResult.text;
                ragSources = searchResult.sources;
                LoggerService.info('agent_rag_result', { found: !!ragContext, intent: currentIntent, traceId, queryComplexity }, userId);
            } else {
                res.write(`data: ${JSON.stringify({ type: 'intent', intent: currentIntent })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'status', message: 'Analyzing request...' })}\n\n`);
            }
            const ragSystemPrompt = ragContext
                ? `\n\n=== KNOWLEDGE BASE CONTEXT ===\n${ragContext}\n==============================\nUse this context to answer the user's question if relevant.`
                : '';

            // 1.3 Tools Preparation
            const allowedTools = AVAILABLE_TOOLS.filter(t => t.isAllowed(userRole));
            const toolsPrompt = allowedTools.length > 0
                ? `\n\nYou have access to the following tools:\n${allowedTools.map(t => `${t.name}: ${t.description}`).join('\n')}\n\nTo use a tool, wrap the JSON call in <tool_use> tags. Example: <tool_use>{"tool": "search", "parameters": {"query": "knowledge base search query"}}</tool_use>`
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
            let repeatCount = 0;
            const startTime = Date.now();

            while (steps < MAX_STEPS) {
                steps++;
                LoggerService.info('agent_step', { step: steps, sessionId, traceId }, userId);

                // Call Model (Non-Streaming for internal reasoning)
                const fullResponse = await BedrockService.sendChat('anthropic.claude-3-5-sonnet-20240620-v1:0', messages);

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

                // Loop Kill-Switch: Resilient Loop Detection (Allow 2 repeats)
                const currentCallPrefix = `${toolCall.tool}:${JSON.stringify(toolCall.parameters)}`;
                if (lastToolCall && currentCallPrefix === lastToolCall.split(':step')[0]) {
                    repeatCount++;
                } else {
                    repeatCount = 0;
                }

                if (repeatCount > 1) {
                    LoggerService.warn('agent_loop_detected', { currentCall: currentCallPrefix, repeatCount, traceId }, userId);
                    finalAnswer = "I've detected an iterative loop. Based on previous attempts, here is the best available answer: " + fullResponse.replace(/<tool_use>[\s\S]*?<\/tool_use>/g, '').trim();
                    break;
                }
                lastToolCall = `${currentCallPrefix}:step${steps}`;
                const tool = allowedTools.find(t => t.name === toolCall.tool);
                if (!tool) {
                    messages.push({ role: 'assistant', content: fullResponse });
                    messages.push({ role: 'user', content: `Error: Tool '${toolCall.tool}' not found or not allowed.` });
                    continue;
                }

                const toolRoll = { tool: toolCall.tool, parameters: toolCall.parameters };
                LoggerService.info('tool_execution', toolRoll, userId);
                if (toolCall.tool !== 'search') {
                    res.write(`data: ${JSON.stringify({ type: 'status', message: `Using ${toolCall.tool}...` })}\n\n`);
                }

                const executionResult = await tool.execute(toolCall.parameters, {
                    userId,
                    role: userRole,
                    department: userDepartment,
                    collectionId
                });

                // 4. Build Result (Sanitized)
                const safeOutput = JSON.stringify(executionResult.result || executionResult.error).replace(/<\/tool_result>/g, '&lt;/tool_result&gt;');
                const resultBlock = `\n<tool_result>\n<tool_name>${toolCall.tool}</tool_name>\n<status>${executionResult.success ? 'success' : 'error'}</status>\n<output>${safeOutput}</output>\n</tool_result>\n`;

                messages.push({ role: 'assistant' as const, content: fullResponse });
                messages.push({ role: 'user' as const, content: resultBlock });

                // 5. History Pinning (Protect sequence and prevent context overflow)
                if (messages.length > 10) {
                    const systemMsg = messages[0];
                    // Keep the last 8 messages (4 pairs) to preserve context while staying efficient
                    const recentHistory = messages.slice(-8);

                    // Simple Validation: Ensure we don't start with Assistant after System if at all possible
                    // Although normalizeMessages handles this, it's better to be clean here.
                    messages = [systemMsg, ...recentHistory];
                    LoggerService.info('agent_history_window_prune', { size: messages.length, traceId }, userId);
                }
            }

            // 6. Streaming Final Answer (Cleaned)
            if (finalAnswer) {
                const cleanedAnswer = finalAnswer.replace(/<tool_use>[\s\S]*?<\/tool_use>/g, '').trim();
                res.write(`data: ${JSON.stringify({ text: cleanedAnswer, traceId })}\n\n`);
                res.write(`data: ${JSON.stringify({
                    type: 'metadata',
                    metadata: {
                        intent: currentIntent,
                        usedRAG: !!ragContext,
                        sources: ragSources,
                        stepsUsed: steps,
                        tokenPressure: messages.length
                    }
                })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'status', message: '' })}\n\n`); // Clear status
                res.write('data: [DONE]\n\n');
                res.end();

                // 7. Reliability Signals (Telemetry)
                const duration = Date.now() - startTime;
                LoggerService.info('agent_reliability_telemetry', {
                    traceId,
                    userId,
                    durationMs: duration,
                    stepsUsed: steps,
                    usedRAG: shouldUseRAG,
                    intent: currentIntent,
                    loopDetected: repeatCount > 1,
                    tokenPressure: messages.length
                });

                // 8. Persistence (Save to Redis & MongoDB)
                const currentMessage = { role: 'user' as const, content: query, timestamp: new Date() };
                const assistantMessage = { role: 'assistant' as const, content: cleanedAnswer, timestamp: new Date() };

                await HistoryService.addMessage(userId, sessionId, currentMessage);
                await HistoryService.addMessage(userId, sessionId, assistantMessage);
                await HistoryService.saveToPersistentStorage(
                    userId,
                    sessionId,
                    [currentMessage, assistantMessage],
                    { totalTokens: 0 }, // Token usage from internal steps is harder to aggregate accurately across steps without more state
                    process.env.ENV_TYPE || 'TEST',
                    'anthropic.claude-3-5-sonnet-20240620-v1:0'
                );

                // 9. Background Summarization & Auto-Naming
                SummarizationService.runUpdate(userId, sessionId, [currentMessage, assistantMessage], smartContext);
                SummarizationService.updateTitle(userId, sessionId, query);
            }

        } catch (error: any) {
            LoggerService.error('Agent Workflow Error', { error: error.message, stack: error.stack, traceId });
            res.write(`data: ${JSON.stringify({ error: 'Agent workflow failed', traceId })}\n\n`);
            res.end();
        }
    }

    private static async quickIntentCheck(query: string, context?: any): Promise<string> {
        try {
            const contextStr = context ? `
Context:
- Last Intent: ${context.last_intent}
- Decisions: ${context.last_decisions?.join(', ')}
- Constraints: ${context.constraints?.join(', ')}
` : '';

            const prompt = `Classify user intent for: "${query}"
            Options: FACT_LOOKUP, RESEARCH, DEBUGGING, DESIGN, CHITCHAT, QUERY.
            ${contextStr}
            Note: If query is ambiguous (e.g. "Why is it broken?"), rely on Last Intent.
            Output ONLY the enum value in <intent></intent> tags.`;

            const response = await BedrockService.sendChat('anthropic.claude-3-5-sonnet-20240620-v1:0', [{ role: 'user', content: prompt }], '', 0.1);
            const match = response.match(/<intent>(.*?)<\/intent>/);
            return match ? match[1].trim() : 'QUERY';
        } catch {
            return 'QUERY';
        }
    }
}
