import { Request, Response } from 'express';
import { HistoryService } from '../services/HistoryService';
import { KnowledgeService } from '../services/KnowledgeService';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { SummarizationService } from '../services/SummarizationService';
import { CalculatorTool } from '../tools/CalculatorTool';
import { SearchTool } from '../tools/SearchTool';
import { CanonicalIR } from '../../../../shared/types';
import { AgentTool } from '../tools/AgentTool';

const MAX_STEPS = 8; // Increased step limit for agentic freedom

// Whitelist of tools for the Agent
const AVAILABLE_TOOLS = [
    new CalculatorTool(),
    new SearchTool()
];

export class AgentWorkflow {
    static async run(req: Request, res: Response) {
        const { userId, message, sessionId, collectionId, userRole, userDepartment, images, fileParses, files } = (req as any).userContext;
        return this.execute(userId, sessionId, message, userRole, userDepartment, collectionId, res, images, fileParses, files);
    }

    static async execute(
        userId: string,
        sessionId: string,
        message: string,
        userRole: string,
        userDepartment: string,
        collectionId: string | undefined,
        res: Response,
        images: any[] = [],
        fileParses: CanonicalIR[] = [],
        files: any[] = []
    ) {
        const query = message;
        const traceId = (global as any).crypto ? (global as any).crypto.randomUUID() : require('crypto').randomUUID();

        // Prepare Tool Config for Bedrock
        const allowedTools = AVAILABLE_TOOLS.filter(t => t.isAllowed(userRole));
        const toolConfig = allowedTools.length > 0 ? {
            tools: allowedTools.map(t => ({
                toolSpec: t.schemaJSON
            }))
        } : undefined;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const totalUsage = { input: 0, output: 0, total: 0 };
        LoggerService.info('agent_workflow_start', { traceId, userId, message }, userId);

        try {
            // 1.1 Load History + Smart Context (Agent Memory)
            const { messages: history, smartContext } = await HistoryService.getContext(userId, sessionId);

            // 1.2 Hybrid RAG Strategy
            const userContext = { userId, role: userRole, department: userDepartment };
            const rollingIntent = smartContext?.rolling?.intent;

            // Intent Check with Claude 3.5 Sonnet
            const intentContext = {
                last_intent: smartContext?.rolling?.intent?.primary || 'QUERY',
                last_decisions: smartContext?.rolling?.decisions || [],
                constraints: smartContext?.rolling?.constraints || []
            };

            const { intent: currentIntent, usage: intentUsage } = await this.quickIntentCheck(query, intentContext);
            totalUsage.input += intentUsage.input;
            totalUsage.output += intentUsage.output;
            totalUsage.total += intentUsage.total;

            let ragContext = '';
            let ragSources: Array<{ id: string, name: string }> = [];
            let ragMaxScore = 0;

            // Hybrid Logic: Pre-fetch ONLY if intent is explicitly about looking up facts
            // Otherwise, let the Agent decide (Tool Use)
            const shouldPrefetchRAG = (currentIntent === 'FACT_LOOKUP' || currentIntent === 'RESEARCH');

            if (shouldPrefetchRAG) {
                res.write(`data: ${JSON.stringify({ type: 'intent', intent: currentIntent })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'status', message: 'Pre-fetching Knowledge...' })}\n\n`);
                const searchResult = await KnowledgeService.search(query, userContext, collectionId, currentIntent);
                ragContext = searchResult.text;
                ragSources = searchResult.sources;
                ragMaxScore = searchResult.maxScore || 0;
                LoggerService.info('agent_rag_prefetch', { found: !!ragContext, score: ragMaxScore, intent: currentIntent, traceId }, userId);
            } else {
                res.write(`data: ${JSON.stringify({ type: 'intent', intent: currentIntent })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'status', message: 'Thinking...' })}\n\n`);
            }

            const ragInstruction = ragMaxScore > 0.65
                ? `INSTRUCTION: High-confidence context pre-fetched. Rely on it.`
                : `INSTRUCTION: Pre-fetched context is partial or missing. You have a 'search' tool. USE IT if you need more information.`;

            const ragSystemPrompt = ragContext
                ? `\n\n=== PRE-FETCHED CONTEXT ===\n${ragContext}\n==============================\n${ragInstruction}`
                : '';

            // 1.3.5 Attached Files Context
            let fileContextPrompt = '';
            if (fileParses.length > 0) {
                fileContextPrompt += `\n\n=== ATTACHED FILE CONTEXT ===\n`;
                fileParses.forEach((ir, idx) => {
                    const originalName = files && files[idx] ? files[idx].name : `File ${idx + 1}`;
                    fileContextPrompt += `\n[File: ${originalName}]\n`;
                    // ... (Truncation logic same as before, simplified for brevity)
                    let charCount = 0;
                    const MAX_CHARS = 20000;
                    for (const block of ir.blocks) {
                        if (charCount > MAX_CHARS) break;
                        fileContextPrompt += `\n${block.content}`;
                        charCount += block.content.length;
                    }
                });
                fileContextPrompt += `\n=== END ATTACHED FILES ===\n`;
            }

            // 1.3.6 Dynamic Refusal Policy
            const isOrganizationalQuery = /policy|regulation|guideline|document|files|contract|agreement|budget|contact|email|who is|fee|calendar|schedule|deadline|registration|course|gpa|grade/i.test(query);
            const isSafeGeneralIntent = !isOrganizationalQuery;

            const refusalRule = isSafeGeneralIntent
                ? `- Basic factual questions may be answered using internal knowledge. 
                   - WARNING: If the question pertains to specific organizational policies absent in context, you MUST refuse or use the Search tool.`
                : `- If the Knowledge Base or Context does not explicitly contain the answer, use the 'search' tool. If still not found, say "I don't have enough information".`;

            // 1.4 Construct Initial Messages
            let messages: any[] = [
                {
                    role: 'system',
                    content: `You are the MFU Learn AI Agent. You are efficient and helpful.
=== TRUTH PRIORITY ===
1. Canonical Memory 
2. Tool Results (Search/Calc)
3. Attached Files
4. Internal Knowledge

=== CRITICAL RULES ===
- Use the 'search' tool if you need information about the University, Policies, or System.
- Use the 'calculator' tool for any math.
${refusalRule}
- Always start by planning your next step if complex.

=== CONTEXT ===
${smartContext?.canonical || 'First session.'}
${JSON.stringify(smartContext?.rolling || {}, null, 2)}
${ragSystemPrompt}
${fileContextPrompt}
`
                },
                ...history.slice(-10).map(m => ({ role: m.role, content: m.content, images: m.images })),
                { role: 'user', content: query, images }
            ];

            let steps = 0;
            let finalAnswer = '';
            const startTime = Date.now();
            let confidence = 'Low';
            let explanation = { basis: 'Internal', assumptions: [] as string[], missing_info: [] as string[] }; // Typed

            // === MAIN AGENT LOOP ===
            while (steps < MAX_STEPS) {
                steps++;
                LoggerService.info('agent_step', { step: steps, sessionId, traceId }, userId);

                // Call Model with Native Tools
                // Note: We don't stream here because we need to check for tool calls
                const { text: fullResponse, usage: stepUsage, stopReason } = await BedrockService.sendChat('anthropic.claude-3-5-sonnet-20240620-v1:0', messages, undefined, 0.5, toolConfig);

                totalUsage.input += stepUsage.input;
                totalUsage.output += stepUsage.output;
                totalUsage.total += stepUsage.total;

                // Handle Response
                if (stopReason === 'tool_use') {
                    // Bedrock returns content as a JSON string or array of blocks
                    // BedrockService normalizes `content` to stringified JSON if it's an array for simplicity in `text`
                    // But we likely need to parse it back to handle specific blocks
                    let contentBlocks: any[] = [];
                    try {
                        contentBlocks = JSON.parse(fullResponse);
                    } catch (e) {
                        // Fallback: if it's just text
                        contentBlocks = [{ type: 'text', text: fullResponse }];
                    }

                    // 1. Append Assistant Turn
                    messages.push({ role: 'assistant', content: contentBlocks });

                    // 2. Execute Tools
                    const toolResults: any[] = [];
                    for (const block of contentBlocks) {
                        if (block.type === 'tool_use') {
                            const toolName = block.name;
                            const toolUseId = block.toolUseId;
                            const toolInput = block.input;

                            LoggerService.info('tool_execution', { tool: toolName, input: toolInput }, userId);
                            res.write(`data: ${JSON.stringify({ type: 'status', message: `Using ${toolName}...` })}\n\n`);

                            const tool = allowedTools.find(t => t.schemaJSON.name === toolName);
                            let resultContent: any;

                            if (tool) {
                                const executionResult = await tool.execute(toolInput, {
                                    userId,
                                    role: userRole,
                                    department: userDepartment,
                                    collectionId
                                });
                                resultContent = executionResult.success ? executionResult.result : `Error: ${executionResult.error}`;
                            } else {
                                resultContent = `Error: Tool ${toolName} not found.`;
                            }

                            toolResults.push({
                                toolUseId: toolUseId,
                                content: [{ json: { result: resultContent } }]
                            });
                        }
                    }

                    // 3. Append Tool Results (User Role in Anthropic API)
                    // Construct a single message with all tool results
                    messages.push({
                        role: 'user',
                        content: toolResults.map(tr => ({
                            type: 'tool_result',
                            toolUseId: tr.toolUseId,
                            content: tr.content // Encapsulated content
                        }))
                    });

                } else {
                    // Final Answer (Pure Text or End of Chain)
                    let textContent = '';
                    try {
                        // Try parsing if it's JSON array
                        const blocks = JSON.parse(fullResponse);
                        if (Array.isArray(blocks)) {
                            textContent = blocks.filter(b => b.type === 'text').map(b => b.text).join('\n');
                        } else {
                            textContent = fullResponse;
                        }
                    } catch {
                        textContent = fullResponse;
                    }

                    finalAnswer = textContent;
                    break;
                }
            }
            // === END LOOP ===

            // 6. Streaming Final Answer
            if (finalAnswer) {
                // ... (Logic for explanation extraction if needed, or we can ask the model to provide it separate)
                // For now, simple heuristic
                if (messages.some(m => JSON.stringify(m).includes('search'))) {
                    confidence = 'High';
                    explanation.basis = 'RAG';
                }

                res.write(`data: ${JSON.stringify({ text: finalAnswer, traceId })}\n\n`);
                res.write(`data: ${JSON.stringify({
                    type: 'metadata',
                    metadata: {
                        intent: currentIntent,
                        usedRAG: !!ragContext || messages.some(m => JSON.stringify(m).includes('search')),
                        sources: ragSources, // Note: Search tool results might not populated this yet
                        stepsUsed: steps,
                        totalTokens: totalUsage.total,
                        explanation
                    }
                })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'status', message: '' })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();

                // 7. Telemetry & Persistence (Same as before)
                const currentMessage = { role: 'user' as const, content: query, timestamp: new Date() };
                const assistantMessage = { role: 'assistant' as const, content: finalAnswer, timestamp: new Date(), meta: { intent: currentIntent, stepsUsed: steps } };

                await HistoryService.addMessage(userId, sessionId, currentMessage);
                await HistoryService.addMessage(userId, sessionId, assistantMessage);
                await HistoryService.saveToPersistentStorage(userId, sessionId, [currentMessage, assistantMessage], { totalTokens: totalUsage.total }, process.env.ENV_TYPE || 'TEST', 'anthropic.claude-3-5-sonnet-20240620-v1:0');
            }

        } catch (error: any) {
            LoggerService.error('Agent Workflow Error', { error: error.message, stack: error.stack, traceId });
            res.write(`data: ${JSON.stringify({ error: 'Agent workflow failed', traceId })}\n\n`);
            res.end();
        }
    }

    private static async quickIntentCheck(query: string, context?: any): Promise<{ intent: string, usage: { input: number, output: number, total: number } }> {
        // Same implementation but ensuring we call Sonnet
        const prompt = `Classify user intent for: "${query}"
        Options: FACT_LOOKUP, RESEARCH, DEBUGGING, DESIGN, CHITCHAT, QUERY.
        Output ONLY the enum value in <intent></intent> tags.`;

        try {
            const { text: response, usage } = await BedrockService.sendChat('anthropic.claude-3-5-sonnet-20240620-v1:0', [{ role: 'user', content: prompt }], '', 0.1);
            const match = response.match(/<intent>(.*?)<\/intent>/);
            return { intent: match ? match[1].trim() : 'QUERY', usage };
        } catch {
            return { intent: 'QUERY', usage: { input: 0, output: 0, total: 0 } };
        }
    }
}
