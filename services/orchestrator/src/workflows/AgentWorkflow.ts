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

            // PRE-RAG REMOVED: Defaulting variables for downstream compatibility
            const currentIntent = 'QUERY';
            const ragMaxScore = 0;

            // 1.3.5 Attached Files Context (ChatGPT-Level Scoped Injection)
            let fileContextPrompt = '';
            let nativeDocBlocks: Array<{ type: 'document', format: string, name: string, data: string }> = []; // Enhancement 2: Native Document Blocks

            if (fileParses.length > 0) {
                // A. Assign Stable IDs (Once)
                const fileParsesWithIds = KnowledgeService.assignBlockIds(fileParses);

                // Enhancement 2: Attempt Native Document Injection for small files
                // If the original file data is available and < 4.5MB, send it natively
                if (files && files.length > 0) {
                    for (const file of files) {
                        const MAX_NATIVE_SIZE = 4.5 * 1024 * 1024; // 4.5MB
                        if (file.buffer && file.buffer.length < MAX_NATIVE_SIZE) {
                            const ext = (file.originalname || '').split('.').pop()?.toLowerCase() || 'pdf';
                            const supportedFormats = ['pdf', 'txt', 'md', 'html', 'csv', 'doc', 'docx', 'xls', 'xlsx'];
                            if (supportedFormats.includes(ext)) {
                                nativeDocBlocks.push({
                                    type: 'document',
                                    format: ext,
                                    name: file.originalname || 'document',
                                    data: Buffer.from(file.buffer).toString('base64')
                                });
                                LoggerService.info('native_doc_injected', { fileName: file.originalname, size: file.buffer.length }, userId);
                            }
                        }
                    }
                }

                // B. Scoped Search (Top 15 Blocks)
                const topBlocks = await KnowledgeService.searchLocal(query, fileParsesWithIds, 15);

                if (topBlocks.length > 0) {
                    fileContextPrompt += `\n\n=== ATTACHED FILE CONTEXT ===\n`;
                    fileContextPrompt += `The following text blocks are extracted from the attached files. Use them to answer.\n`;

                    topBlocks.forEach(block => {
                        const fileName = block.metadata?.fileName || 'unknown_file';
                        const pageInfo = block.metadata?.page ? ` (Page ${block.metadata.page})` : '';
                        fileContextPrompt += `\n[${fileName}${pageInfo}]\n${block.content}\n`;
                    });
                    fileContextPrompt += `\n=== END ATTACHED EVIDENCE ===\n`;
                }
            }

            // 1.3.6 Dynamic Refusal Policy
            const isOrganizationalQuery = /policy|regulation|guideline|document|files|contract|agreement|budget|contact|email|who is|fee|calendar|schedule|deadline|registration|course|gpa|grade/i.test(query);
            const isSafeGeneralIntent = !isOrganizationalQuery;

            const refusalRule = isSafeGeneralIntent
                ? `- Basic factual questions may be answered using internal knowledge.
                   - WARNING: If the question pertains to specific organizational policies absent in context, you MUST use the Search tool.`
                : `- If the Knowledge Base or Context does not explicitly contain the answer, you MUST use the 'search' tool to find it. Do NOT say "I don't have enough information" without searching first.`;

            // Enhancement 4: Multi-Block System Prompts
            // Split the system prompt into logical blocks for better compartmentalization and caching
            const systemBlocks: Array<{ text: string }> = [];

            // Block 1: Persona & Core Rules (Static - great for caching)
            systemBlocks.push({
                text: `You are the MFU Learn AI Agent. You are efficient and helpful.
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
- If the attached files or search results do NOT contain the answer, say so clearly. Do NOT guess.` });

            // Block 2: Session Context (Changes per session)
            systemBlocks.push({
                text: `=== SESSION CONTEXT ===
${smartContext?.canonical || 'First session.'}
${JSON.stringify(smartContext?.rolling || {}, null, 2)}`
            });

            // Block 3: RAG Evidence (Changes per query)
            if (fileContextPrompt) {
                systemBlocks.push({ text: fileContextPrompt });
            }

            // Enhancement 3: Guardrails Configuration
            const guardrailConfig = process.env.BEDROCK_GUARDRAIL_ID ? {
                guardrailIdentifier: process.env.BEDROCK_GUARDRAIL_ID,
                guardrailVersion: process.env.BEDROCK_GUARDRAIL_VERSION || 'DRAFT'
            } : undefined;

            // 1.4 Construct Initial Messages
            // Enhancement 5: Include native document blocks in user message
            const userContent: any[] = [];
            if (nativeDocBlocks.length > 0) {
                userContent.push(...nativeDocBlocks);
            }
            userContent.push({ type: 'text', text: query });
            if (images && images.length > 0) {
                userContent.push(...images.map((img: any) => ({ type: 'image', source: img })));
            }

            let messages: any[] = [
                {
                    role: 'system',
                    content: systemBlocks  // Enhancement 4: Array of blocks
                },
                ...history.slice(-10).map(m => ({ role: m.role, content: m.content, images: m.images })),
                { role: 'user', content: userContent }
            ];

            let steps = 0;
            let finalAnswer = '';
            const startTime = Date.now();
            let confidence = 'Low';
            let explanation = { basis: 'Internal', assumptions: [] as string[], missing_info: [] as string[] }; // Typed

            // Scope variables for metadata (outside loop)
            // Scope variables for metadata (outside loop)
            let answerState = 'UNVERIFIED'; // LOCK 2: Default State
            let answerMode = 'internal'; // LOCK 3: Default Mode
            const usedTools = new Set<string>(); // R3: Robust Tool Detection

            // === MAIN AGENT LOOP ===
            while (steps < MAX_STEPS) {
                steps++;
                LoggerService.info('agent_step', { step: steps, sessionId, traceId }, userId);

                // Call Model with Native Tools
                // Note: We don't stream here because we need to check for tool calls
                const { text: fullResponse, usage: stepUsage, stopReason } = await BedrockService.sendChat(
                    'anthropic.claude-3-5-sonnet-20240620-v1:0',
                    messages,
                    undefined,  // system is already in messages[0]
                    0.5,
                    toolConfig,
                    guardrailConfig  // Enhancement 3: Pass guardrails
                );

                LoggerService.info('agent_model_response', {
                    step: steps,
                    stopReason,
                    responseLength: fullResponse?.length,
                    rawResponsePreview: fullResponse?.substring(0, 200)
                }, userId);

                // ... (Usage tracking) ...
                totalUsage.input += stepUsage.input;
                totalUsage.output += stepUsage.output;
                totalUsage.total += stepUsage.total;

                // Handle Response
                if (stopReason === 'tool_use') {
                    LoggerService.info('agent_tool_use_detected', { step: steps }, userId);
                    // ... (Parsing logic) ...
                    let contentBlocks: any[] = [];
                    try {
                        contentBlocks = JSON.parse(fullResponse);
                    } catch (e) {
                        contentBlocks = [{ type: 'text', text: fullResponse }];
                    }

                    messages.push({ role: 'assistant', content: contentBlocks });

                    const toolResults: any[] = [];
                    for (const block of contentBlocks) {
                        if (block.type === 'tool_use') {
                            const toolName = block.name;
                            usedTools.add(toolName); // R3: Track tool usage

                            const toolUseId = block.toolUseId;
                            const toolInput = block.input;
                            // ... (Execution logic) ...
                            LoggerService.info('tool_execution', { tool: toolName, input: toolInput }, userId);
                            res.write(`data: ${JSON.stringify({ type: 'status', message: `Using ${toolName}...` })}\n\n`);

                            const tool = allowedTools.find(t => t.schemaJSON.name === toolName);
                            let resultContent: any;

                            if (tool) {
                                LoggerService.info('agent_executing_tool', { tool: toolName, input: toolInput }, userId);
                                const executionResult = await tool.execute(toolInput, {
                                    userId,
                                    role: userRole,
                                    department: userDepartment,
                                    collectionId
                                });
                                resultContent = executionResult.success ? executionResult.result : `Error: ${executionResult.error}`;
                                LoggerService.info('agent_tool_result', { tool: toolName, success: executionResult.success, resultLength: resultContent?.length }, userId);

                                // Search results are used for context but no citation tracking needed
                                if (toolName === 'search' && executionResult.success) {
                                    usedTools.add('search');
                                }
                            } else {
                                resultContent = `Error: Tool ${toolName} not found.`;
                            }

                            toolResults.push({
                                toolUseId: toolUseId,
                                content: [{ json: { result: resultContent } }]
                            });
                        }
                    }
                    // ... (Append results) ...
                    messages.push({
                        role: 'user',
                        content: toolResults.map(tr => ({
                            type: 'tool_result',
                            toolUseId: tr.toolUseId,
                            content: tr.content
                        }))
                    });


                } else {
                    // ... (Final Answer Logic) ...
                    let textContent = '';
                    try {
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

                    // Simplified answer mode logic (no citations)
                    if (fileContextPrompt) {
                        answerMode = 'file_grounded';
                        answerState = 'VERIFIED';
                    } else if (usedTools.has('search')) {
                        answerMode = 'rag';
                        answerState = 'VERIFIED';
                    }

                    break;
                }
            }

            // === END LOOP ===

            // 6. Streaming Final Answer
            if (finalAnswer) {
                // ... (Logic for explanation extraction if needed, or we can ask the model to provide it separate)
                // For now, simple heuristic
                if (answerMode === 'file_grounded' || answerMode === 'rag') {
                    confidence = 'High';
                    explanation.basis = 'RAG'; // Legacy field compatibility
                }

                res.write(`data: ${JSON.stringify({ text: finalAnswer, traceId })}\n\n`);
                res.write(`data: ${JSON.stringify({
                    type: 'metadata',
                    metadata: {
                        intent: currentIntent,
                        answer_mode: answerMode,
                        answer_state: answerState,
                        usedRAG: answerMode !== 'internal',
                        stepsUsed: steps,
                        totalTokens: totalUsage.total,
                        explanation
                    }
                })}\n\n`);
                res.write(`data: ${JSON.stringify({ type: 'status', message: '' })}\n\n`);
                res.write('data: [DONE]\n\n');
                res.end();

                // 7. Telemetry & Persistence
                const currentMessage = { role: 'user' as const, content: query, timestamp: new Date() };
                const assistantMessage = {
                    role: 'assistant' as const,
                    content: finalAnswer,
                    timestamp: new Date(),
                    meta: {
                        intent: currentIntent,
                        stepsUsed: steps,
                        answer_mode: answerMode,
                        answer_state: answerState,
                        usedRAG: answerMode !== 'internal',
                        confidence,
                        explanation
                    }
                };

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
            const { text: response, usage } = await BedrockService.sendChat('anthropic.claude-3-5-sonnet-20240620-v1:0', [{ role: 'user', content: prompt }], undefined, 0.1);
            const match = response.match(/<intent>(.*?)<\/intent>/);
            return { intent: match ? match[1].trim() : 'QUERY', usage };
        } catch {
            return { intent: 'QUERY', usage: { input: 0, output: 0, total: 0 } };
        }
    }
}
