import { Request, Response } from 'express';
import { HistoryService } from '../services/HistoryService';
import { KnowledgeService } from '../services/KnowledgeService';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { SummarizationService } from '../services/SummarizationService';
import { ChatAttachmentService } from '../services/ChatAttachmentService';
import { CalculatorTool } from '../tools/CalculatorTool';
import { SearchTool } from '../tools/SearchTool';
import { MODELS, AGENT_CONFIG } from '../config/models';


// Whitelist of tools for the Agent
const AVAILABLE_TOOLS = [
    new CalculatorTool(),
    new SearchTool()
];

// ── SSE Event Type Constants ──
const EVENT = {
    AGENT_START: 'agent_start',
    CONTEXT_LOADED: 'context_loaded',
    AGENT_STEP: 'agent_step',
    THINKING: 'thinking',
    TOOL_START: 'tool_start',
    TOOL_COMPLETE: 'tool_complete',
    ANSWER_START: 'answer_start',
    ANSWER_DELTA: 'answer_delta',
    ANSWER_DONE: 'answer_done',
    STEP_USAGE: 'step_usage',
    AGENT_COMPLETE: 'agent_complete',
    STATUS: 'status',
    METADATA: 'metadata',
    FILE_PROGRESS: 'file_progress',
    FILE_UPLOADED: 'file_uploaded',
    TITLE: 'title',
} as const;

export class AgentWorkflow {
    static async run(req: Request, res: Response) {
        const { userId, message, sessionId, collectionId, userRole, userDepartment, images, files } = (req as any).userContext;
        return this.execute(userId, sessionId, message, userRole, userDepartment, collectionId, res, images, files);
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
        files: any[] = []
    ) {
        const query = message;
        const traceId = (global as any).crypto ? (global as any).crypto.randomUUID() : require('crypto').randomUUID();
        const workflowStartTime = Date.now();

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

        // Client disconnect detection for SSE
        let clientDisconnected = false;
        const req = (res as any).req;
        if (req) req.on('close', () => { clientDisconnected = true; });

        const safeWrite = (data: string) => {
            if (!clientDisconnected && !res.writableEnded) res.write(data);
        };

        // ── Helper: Emit structured SSE event ──
        const eventLog: any[] = [];
        const emitEvent = (type: string, payload: Record<string, any> = {}) => {
            const event = { type, ...payload, timestamp: new Date().toISOString() };
            safeWrite(`data: ${JSON.stringify(event)}\n\n`);
            // Store in eventLog for MongoDB persistence (skip high-frequency deltas)
            if (type !== EVENT.ANSWER_DELTA) {
                eventLog.push(event);
            }
        };

        const totalUsage = { input: 0, output: 0, total: 0 };
        LoggerService.info('agent_workflow_start', { traceId, userId, message }, userId);

        // ▸ EVENT: agent_start
        emitEvent(EVENT.AGENT_START, { traceId, sessionId });

        try {
            // 1.1 Load History + Smart Context (Agent Memory)
            emitEvent(EVENT.STATUS, { message: 'กำลังโหลดบริบทการสนทนา...' });
            const { messages: history, smartContext } = await HistoryService.getContext(userId, sessionId);

            // ▸ EVENT: context_loaded
            emitEvent(EVENT.CONTEXT_LOADED, {
                historyCount: history.length,
                hasSmartContext: !!smartContext,
                smartContextVersion: smartContext?.version || 0
            });

            // 1.3.5 Attached Files — Send directly as native Converse API document blocks
            let nativeDocBlocks: Array<{ type: 'document', format: string, name: string, data: string }> = [];
            let extractedTextBlocks: Array<{ fileName: string, text: string }> = [];
            // Track Uploads for Persistence (Concurrent)
            let uploadPromises: Promise<any>[] = [];

            LoggerService.info('agent_files_received', {
                filesCount: files?.length || 0,
                fileDetails: (files || []).map((f: any) => ({
                    name: f.originalname || f.name,
                    size: f.size,
                    hasBuffer: !!f.buffer,
                    bufferLength: f.buffer?.length
                }))
            }, userId);

            if (files && files.length > 0) {
                const MAX_NATIVE_SIZE = 4.5 * 1024 * 1024; // 4.5MB Converse API limit
                const MAX_EXTRACTED_TEXT_CHARS = 100_000;    // ~100K chars for context window safety
                const supportedFormats = ['pdf', 'txt', 'md', 'html', 'csv', 'doc', 'docx', 'xls', 'xlsx'];

                const totalFiles = files.length;
                for (let fi = 0; fi < files.length; fi++) {
                    const file = files[fi];
                    const fileName = file.originalname || file.name || 'file';
                    const fileSizeMB = ((file.buffer?.length || 0) / (1024 * 1024)).toFixed(1);

                    // Progress helper
                    const emitProgress = (stage: string, percent: number, detail?: string) => {
                        safeWrite(`data: ${JSON.stringify({
                            type: EVENT.FILE_PROGRESS,
                            fileName,
                            fileIndex: fi,
                            totalFiles,
                            stage,
                            percent: Math.round(percent),
                            detail: detail || ''
                        })}\n\n`);
                    };

                    emitProgress('preparing', 5, `${fileSizeMB} MB`);

                    if (!file.buffer) {
                        LoggerService.warn('file_no_buffer', { fileName }, userId);
                        emitProgress('error', 0, 'ไม่พบข้อมูลไฟล์');
                        continue;
                    }

                    const ext = (fileName).split('.').pop()?.toLowerCase() || 'pdf';
                    if (!supportedFormats.includes(ext)) {
                        LoggerService.warn('unsupported_file_format', { fileName, ext }, userId);
                        emitProgress('error', 0, `ไม่รองรับไฟล์ .${ext}`);
                        continue;
                    }

                    // Start Upload (Fire & Forget promise, collected later)
                    uploadPromises.push(
                        ChatAttachmentService.uploadFile(file.buffer, fileName, file.mediaType || 'application/pdf', userId)
                            .then(meta => {
                                // Emit event for frontend to show clickable link immediately
                                safeWrite(`data: ${JSON.stringify({
                                    type: EVENT.FILE_UPLOADED,
                                    fileName,
                                    metadata: meta
                                })}\n\n`);
                                return { ...meta, fileType: ext };
                            })
                            .catch(err => {
                                LoggerService.warn('file_upload_background_failed', { fileName, error: err.message }, userId);
                                return null;
                            })
                    );

                    if (file.buffer.length < MAX_NATIVE_SIZE) {
                        // Small file → native document block (best quality)
                        emitProgress('encoding', 50, 'กำลังเข้ารหัสเอกสาร...');

                        const rawName = (fileName)
                            .replace(/\.[^.]+$/, '')
                            .replace(/[^a-zA-Z0-9\s\-\(\)\[\]]/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim()
                            || 'document';

                        nativeDocBlocks.push({
                            type: 'document',
                            format: ext,
                            name: rawName,
                            data: Buffer.from(file.buffer).toString('base64')
                        });
                        LoggerService.info('native_doc_injected', { fileName, sanitizedName: rawName, ext, size: file.buffer.length }, userId);
                        emitProgress('done', 100, 'พร้อมส่ง');
                    } else {
                        // Large file → fallback: extract text via KnowledgeService
                        LoggerService.info('file_too_large_extracting_text', {
                            fileName,
                            size: file.buffer.length,
                            limit: MAX_NATIVE_SIZE
                        }, userId);

                        let extractPercent = 20;
                        const progressTimer = setInterval(() => {
                            extractPercent = Math.min(extractPercent + 5, 85);
                            emitProgress('extracting', extractPercent, `ไฟล์ ${fileSizeMB} MB — กำลังดึงข้อความ/OCR (${Math.round(extractPercent)}%)...`);
                        }, 1000);

                        try {
                            const ir = await KnowledgeService.parseFile(
                                file.buffer,
                                fileName,
                                file.mediaType || 'application/pdf'
                            );
                            clearInterval(progressTimer);

                            emitProgress('extracting', 90, 'ประมวลผลข้อความเสร็จสิ้น...');

                            if (ir && ir.blocks && ir.blocks.length > 0) {
                                let fullText = ir.blocks.map((b: any) => b.content).join('\n\n');
                                if (fullText.length > MAX_EXTRACTED_TEXT_CHARS) {
                                    fullText = fullText.substring(0, MAX_EXTRACTED_TEXT_CHARS) + '\n\n[... ข้อความถูกตัดเนื่องจากยาวเกินไป ...]';
                                }
                                extractedTextBlocks.push({ fileName, text: fullText });
                                LoggerService.info('file_text_extracted', {
                                    fileName,
                                    blocksCount: ir.blocks.length,
                                    textLength: fullText.length
                                }, userId);
                                emitProgress('done', 100, `ดึงข้อความสำเร็จ (${ir.blocks.length} blocks)`);
                            } else {
                                LoggerService.warn('file_text_extraction_empty', { fileName }, userId);
                                emitProgress('error', 0, 'ไม่สามารถดึงข้อความได้');
                            }
                        } catch (extractError: any) {
                            clearInterval(progressTimer);
                            LoggerService.error('file_text_extraction_failed', {
                                fileName,
                                error: extractError.message
                            }, userId);
                            emitProgress('error', 0, 'การดึงข้อความล้มเหลว');
                        }
                    }
                }
            }

            LoggerService.info('agent_doc_blocks_summary', {
                nativeDocBlocks: nativeDocBlocks.length,
                extractedTextBlocks: extractedTextBlocks.length
            }, userId);

            // 1.3.6 Dynamic Refusal Policy
            const isOrganizationalQuery = /policy|regulation|guideline|document|files|contract|agreement|budget|contact|email|who is|fee|calendar|schedule|deadline|registration|course|gpa|grade/i.test(query);
            const isSafeGeneralIntent = !isOrganizationalQuery;

            const refusalRule = isSafeGeneralIntent
                ? `- Basic factual questions may be answered using internal knowledge.
                   - WARNING: If the question pertains to specific organizational policies absent in context, you MUST use the Search tool.`
                : `- If the Knowledge Base or Context does not explicitly contain the answer, you MUST use the 'search' tool to find it. Do NOT say "I don't have enough information" without searching first.`;

            // Enhancement 4: Multi-Block System Prompts
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

            // Block 3: Attached file hints
            if (nativeDocBlocks.length > 0) {
                const fileNames = nativeDocBlocks.map(d => d.name).join(', ');
                systemBlocks.push({ text: `The user has attached ${nativeDocBlocks.length} document(s): ${fileNames}. They are included as native document blocks in the user message. Read and analyze them to answer the user's question.` });
            }
            if (extractedTextBlocks.length > 0) {
                const fileNames = extractedTextBlocks.map(b => b.fileName).join(', ');
                systemBlocks.push({ text: `The user has attached ${extractedTextBlocks.length} large file(s): ${fileNames}. The text content has been extracted and is included in the user message. Read and analyze the extracted text to answer the user's question.` });
            }

            // Enhancement 3: Guardrails Configuration
            const guardrailConfig = process.env.BEDROCK_GUARDRAIL_ID ? {
                guardrailIdentifier: process.env.BEDROCK_GUARDRAIL_ID,
                guardrailVersion: process.env.BEDROCK_GUARDRAIL_VERSION || 'DRAFT'
            } : undefined;

            // 1.4 Construct Initial Messages
            const userContent: any[] = [];
            if (nativeDocBlocks.length > 0) {
                userContent.push(...nativeDocBlocks);
            }
            if (extractedTextBlocks.length > 0) {
                for (const etb of extractedTextBlocks) {
                    userContent.push({
                        type: 'text',
                        text: `=== Extracted content from "${etb.fileName}" ===\n${etb.text}\n=== End of "${etb.fileName}" ===`
                    });
                }
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
            let explanation = { basis: 'Internal', assumptions: [] as string[], missing_info: [] as string[] };

            let answerState = 'UNVERIFIED';
            let answerMode = 'internal';
            const usedTools = new Set<string>();

            // === MAIN AGENT LOOP ===
            while (steps < AGENT_CONFIG.MAX_STEPS) {
                // Wall-clock timeout protection
                if (Date.now() - startTime > AGENT_CONFIG.MAX_WALL_MS) {
                    LoggerService.warn('agent_timeout', { steps, elapsed: Date.now() - startTime, traceId }, userId);
                    finalAnswer = 'ขออภัยครับ คำขอใช้เวลาเกินกำหนด กรุณาลองถามใหม่อีกครั้ง';
                    answerMode = 'internal';
                    answerState = 'TIMEOUT';
                    emitEvent(EVENT.STATUS, { message: 'หมดเวลาดำเนินการ' });
                    break;
                }

                // Client disconnected — stop processing
                if (clientDisconnected) {
                    LoggerService.info('agent_client_disconnected', { steps, traceId }, userId);
                    return;
                }

                steps++;
                LoggerService.info('agent_step', { step: steps, sessionId, traceId }, userId);

                // ▸ EVENT: agent_step
                emitEvent(EVENT.AGENT_STEP, { step: steps, maxSteps: AGENT_CONFIG.MAX_STEPS });

                // Diagnostic: log message structure before sending (only on step 1)
                if (steps === 1) {
                    const msgStructure = messages.map((m: any, i: number) => ({
                        idx: i,
                        role: m.role,
                        contentType: typeof m.content,
                        isArray: Array.isArray(m.content),
                        blockTypes: Array.isArray(m.content)
                            ? m.content.map((b: any) => b.type || Object.keys(b)[0])
                            : undefined,
                        contentLength: typeof m.content === 'string' ? m.content.length : undefined
                    }));
                    console.log(`[AgentWorkflow] Messages structure before sendChat:`, JSON.stringify(msgStructure));
                }

                // ▸ EVENT: thinking
                emitEvent(EVENT.THINKING, { step: steps, message: `กำลังวิเคราะห์... (ขั้นตอนที่ ${steps})` });

                const stepStartTime = Date.now();

                const { text: fullResponse, usage: stepUsage, stopReason } = await BedrockService.sendChat(
                    MODELS.PRIMARY,
                    messages,
                    undefined,
                    0.5,
                    toolConfig,
                    guardrailConfig
                );

                const stepDurationMs = Date.now() - stepStartTime;

                LoggerService.info('agent_model_response', {
                    step: steps,
                    stopReason,
                    responseLength: fullResponse?.length,
                    rawResponsePreview: fullResponse?.substring(0, 200),
                    durationMs: stepDurationMs
                }, userId);

                // ... (Usage tracking) ...
                totalUsage.input += stepUsage.input;
                totalUsage.output += stepUsage.output;
                totalUsage.total += stepUsage.total;

                // ▸ EVENT: step_usage
                emitEvent(EVENT.STEP_USAGE, {
                    step: steps,
                    input: stepUsage.input,
                    output: stepUsage.output,
                    total: stepUsage.total,
                    durationMs: stepDurationMs
                });

                // Handle Response
                if (stopReason === 'tool_use') {
                    LoggerService.info('agent_tool_use_detected', { step: steps }, userId);
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
                            usedTools.add(toolName);

                            const toolUseId = block.toolUseId;
                            const toolInput = block.input;

                            LoggerService.info('tool_execution', { tool: toolName, input: toolInput }, userId);

                            // ▸ EVENT: tool_start
                            emitEvent(EVENT.TOOL_START, {
                                toolName,
                                input: toolInput,
                                step: steps
                            });
                            emitEvent(EVENT.STATUS, { message: `🔧 Using ${toolName}...` });

                            const toolStartTime = Date.now();
                            const tool = allowedTools.find(t => t.schemaJSON.name === toolName);
                            let resultContent: any;
                            let toolSuccess = false;

                            if (tool) {
                                LoggerService.info('agent_executing_tool', { tool: toolName, input: toolInput }, userId);
                                const executionResult = await tool.execute(toolInput, {
                                    userId,
                                    role: userRole,
                                    department: userDepartment,
                                    collectionId
                                });
                                resultContent = executionResult.success ? executionResult.result : `Error: ${executionResult.error}`;
                                toolSuccess = executionResult.success;
                                LoggerService.info('agent_tool_result', { tool: toolName, success: executionResult.success, resultLength: resultContent?.length }, userId);

                                if (toolName === 'search' && executionResult.success) {
                                    usedTools.add('search');
                                }
                            } else {
                                resultContent = `Error: Tool ${toolName} not found.`;
                            }

                            const toolDurationMs = Date.now() - toolStartTime;

                            // ▸ EVENT: tool_complete
                            const resultPreview = typeof resultContent === 'string'
                                ? resultContent.substring(0, 300)
                                : JSON.stringify(resultContent).substring(0, 300);

                            emitEvent(EVENT.TOOL_COMPLETE, {
                                toolName,
                                success: toolSuccess,
                                resultPreview,
                                durationMs: toolDurationMs,
                                step: steps
                            });

                            toolResults.push({
                                toolUseId: toolUseId,
                                content: [{ json: { result: resultContent } }]
                            });
                        }
                    }
                    // Append tool results
                    messages.push({
                        role: 'user',
                        content: toolResults.map(tr => ({
                            type: 'tool_result',
                            toolUseId: tr.toolUseId,
                            content: tr.content
                        }))
                    });


                } else {
                    // === FINAL ANSWER ===
                    // Determine answer mode before streaming
                    if (nativeDocBlocks.length > 0) {
                        answerMode = 'file_grounded';
                        answerState = 'VERIFIED';
                    } else if (usedTools.has('search')) {
                        answerMode = 'rag';
                        answerState = 'VERIFIED';
                    }

                    // ▸ EVENT: answer_start
                    emitEvent(EVENT.ANSWER_START, { answerMode });

                    // Parse the content from the synchronous response
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

                    // Stream the final answer token-by-token via simulated chunks
                    // Break text into small chunks for progressive rendering
                    const CHUNK_SIZE = 12; // Characters per chunk — balance between speed and smoothness
                    for (let i = 0; i < finalAnswer.length; i += CHUNK_SIZE) {
                        const delta = finalAnswer.substring(i, i + CHUNK_SIZE);
                        emitEvent(EVENT.ANSWER_DELTA, { delta });
                        // Tiny delay to prevent browser buffer coalescing (only if large text)
                        if (finalAnswer.length > 200 && i % (CHUNK_SIZE * 10) === 0 && i > 0) {
                            await new Promise(r => setTimeout(r, 1));
                        }
                    }

                    // ▸ EVENT: answer_done
                    emitEvent(EVENT.ANSWER_DONE, { fullLength: finalAnswer.length });

                    break;
                }
            }

            // === END LOOP ===

            // 6. Emit final metadata & completion events
            if (finalAnswer) {
                if (answerMode === 'file_grounded' || answerMode === 'rag') {
                    confidence = 'High';
                    explanation.basis = 'RAG';
                }

                const totalDurationMs = Date.now() - workflowStartTime;

                // ▸ EVENT: metadata (backward compatible)
                emitEvent(EVENT.METADATA, {
                    metadata: {
                        answer_mode: answerMode,
                        answer_state: answerState,
                        usedRAG: answerMode !== 'internal',
                        stepsUsed: steps,
                        totalTokens: totalUsage.total,
                        explanation
                    }
                });

                // ▸ EVENT: agent_complete
                emitEvent(EVENT.AGENT_COMPLETE, {
                    totalSteps: steps,
                    totalTokens: totalUsage.total,
                    durationMs: totalDurationMs,
                    toolsUsed: Array.from(usedTools),
                    answerMode
                });

                // Clear status and close stream
                emitEvent(EVENT.STATUS, { message: '' });
                safeWrite('data: [DONE]\n\n');
                if (!res.writableEnded) res.end();

                // 7. Telemetry & Persistence

                // Await uploads
                const uploadedAttachments: any[] = [];
                if (uploadPromises.length > 0) {
                    const results = await Promise.all(uploadPromises);
                    results.forEach(r => {
                        if (r) uploadedAttachments.push(r);
                    });
                }

                const currentMessage: any = { role: 'user', content: query, timestamp: new Date() };
                if (uploadedAttachments.length > 0) {
                    currentMessage.attachments = uploadedAttachments;
                }

                const assistantMessage = {
                    role: 'assistant' as const,
                    content: finalAnswer,
                    timestamp: new Date(),
                    meta: {
                        stepsUsed: steps,
                        answer_mode: answerMode,
                        answer_state: answerState,
                        usedRAG: answerMode !== 'internal',
                        confidence,
                        explanation
                    },
                    // Persist agent event flow to MongoDB (excluding high-frequency deltas)
                    agentEvents: eventLog.map(e => ({
                        type: e.type,
                        step: e.step,
                        toolName: e.toolName,
                        input: e.input,
                        resultPreview: e.resultPreview,
                        success: e.success,
                        durationMs: e.durationMs,
                        message: e.message,
                        answerMode: e.answerMode,
                        totalSteps: e.totalSteps,
                        totalTokens: e.totalTokens,
                        tokens: e.total ? { input: e.input, output: e.output, total: e.total } : undefined,
                        timestamp: new Date(e.timestamp)
                    }))
                };

                await HistoryService.addMessage(userId, sessionId, currentMessage);
                await HistoryService.addMessage(userId, sessionId, assistantMessage);
                await HistoryService.saveToPersistentStorage(userId, sessionId, [currentMessage, assistantMessage], { totalTokens: totalUsage.total }, process.env.ENV_TYPE || 'TEST', MODELS.PRIMARY);

                // Log Token Usage for Dashboard
                await LoggerService.info('chat_completion', {
                    tokens: totalUsage,
                    model: MODELS.PRIMARY,
                    steps,
                    sessionId,
                    traceId
                }, userId);

                // 8. Background Summarization (fire-and-forget)
                SummarizationService.runUpdate(userId, sessionId, [currentMessage, assistantMessage], smartContext || {
                    canonical: '', rolling: { facts: [], intent: { primary: 'QUERY', confidence: 1 }, constraints: [], decisions: [], open_questions: [], confidence_score: 1 },
                    version: 0, hashes: { canonical: '', rolling: '', raw: '' }, lastCanonizedAt: new Date()
                }).catch((e: any) => LoggerService.error('Background Summary Failed', e));

                // 9. Auto-Title Generation (First Turn Only)
                if (history.length === 0) {
                    try {
                        const newTitle = await SummarizationService.updateTitle(userId, sessionId, query);
                        if (newTitle) {
                            safeWrite(`data: ${JSON.stringify({ type: EVENT.TITLE, title: newTitle })}\n\n`);
                        }
                    } catch (e: any) {
                        LoggerService.error('Title Gen Failed', e);
                    }
                }
            }

        } catch (error: any) {
            LoggerService.error('Agent Workflow Error', { error: error.message, stack: error.stack, traceId });
            if (!clientDisconnected && !res.writableEnded) {
                safeWrite(`data: ${JSON.stringify({ error: 'Agent workflow failed', traceId })}\n\n`);
                res.end();
            }
        }
    }

}
