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

export class AgentWorkflow {
    static async run(req: Request, res: Response) {
        const { userId, message, sessionId, collectionId, userRole, userDepartment, images, files } = (req as any).userContext;
        const enableStream = req.query.stream !== 'false';
        return this.execute(userId, sessionId, message, userRole, userDepartment, collectionId, res, images, files, enableStream);
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
        files: any[] = [],
        enableStream: boolean = true
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

        // Client disconnect detection for SSE
        let clientDisconnected = false;
        const req = (res as any).req;
        if (req) req.on('close', () => { clientDisconnected = true; });

        const safeWrite = (data: string) => {
            if (!clientDisconnected && !res.writableEnded) res.write(data);
        };

        // Declare variables at function scope (not inside loop)
        const totalUsage = { input: 0, output: 0, total: 0 };
        let steps = 0;
        let stopReason = '';
        let fullResponse = '';
        let answerMode = 'internal';
        let answerState = 'UNVERIFIED';
        let finalAnswer = '';
        let confidence: string = 'Medium';
        let explanation: { basis: string; assumptions: string[]; missing_info: string[] } = {
            basis: 'Internal',
            assumptions: [],
            missing_info: []
        };
        let contentBlocks: any[] = [];
        let uploadPromises: Promise<any>[] = [];
        let usedTools = new Set<string>();

        LoggerService.info('agent_workflow_start', { traceId, userId, message }, userId);

        try {
            // Helper: Clean duplicate consecutive user messages from history
            const cleanupDuplicateMessages = (messages: any[]): any[] => {
                if (!messages || messages.length === 0) return [];

                const cleaned: any[] = [];
                let prevMessage: any = null;

                for (const msg of messages) {
                    // Skip if duplicate user message (same role, same content, within 60 seconds)
                    if (prevMessage &&
                        prevMessage.role === 'user' &&
                        msg.role === 'user' &&
                        prevMessage.content === msg.content &&
                        msg.timestamp && prevMessage.timestamp) {

                        const timeDiff = new Date(msg.timestamp).getTime() - new Date(prevMessage.timestamp).getTime();

                        if (timeDiff < 60000) { // Within 60 seconds
                            LoggerService.info('history_duplicate_skipped', {
                                content: msg.content.substring(0, 50),
                                timeDiff
                            }, userId);
                            continue; // Skip this duplicate
                        }
                    }

                    cleaned.push(msg);
                    prevMessage = msg;
                }

                if (cleaned.length < messages.length) {
                    LoggerService.info('history_cleaned', {
                        original: messages.length,
                        cleaned: cleaned.length,
                        removed: messages.length - cleaned.length
                    }, userId);
                }

                return cleaned;
            };

            // 1.1 Load History + Smart Context (Agent Memory)
            const { messages: rawHistory, smartContext } = await HistoryService.getContext(userId, sessionId);
            const history = cleanupDuplicateMessages(rawHistory);

            // 1.2 Save User Message Immediately (Prevent Data Loss)
            // Check if this exact message was already saved (prevent duplicates on retry/regenerate)
            const lastMessage = history.length > 0 ? history[history.length - 1] : null;
            const isDuplicate = lastMessage &&
                lastMessage.role === 'user' &&
                lastMessage.content === query &&
                lastMessage.timestamp &&
                (new Date().getTime() - new Date(lastMessage.timestamp).getTime()) < 5000; // Within 5 seconds

            if (!isDuplicate) {
                const initialUserMessage: any = {
                    role: 'user',
                    content: query,
                    timestamp: new Date(),
                    attachments: files?.map((f: any) => ({
                        fileName: f.originalname || f.name,
                        fileSize: f.size,
                        mediaType: f.mediaType || f.mimetype
                    }))
                };

                await HistoryService.addMessage(userId, sessionId, initialUserMessage);
                HistoryService.saveToPersistentStorage(userId, sessionId, [initialUserMessage], { totalTokens: 0 }, process.env.ENV_TYPE || 'TEST', MODELS.PRIMARY)
                    .catch(err => LoggerService.warn('initial_msg_save_failed', { error: err.message }, userId));
            } else {
                LoggerService.info('user_message_duplicate_skipped', { query: query.substring(0, 50) }, userId);
            }

            // 1.3.5 Attached Files — Send directly as native Converse API document blocks
            let nativeDocBlocks: Array<{ type: 'document', format: string, name: string, data: string }> = [];
            let extractedTextBlocks: Array<{ fileName: string, text: string }> = [];

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
                            type: 'file_progress',
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
                                safeWrite(`data: ${JSON.stringify({
                                    type: 'file_uploaded',
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
                ...history.slice(-10).map(m => ({ role: m.role, content: m.content, images: m.images })),
                { role: 'user', content: userContent }
            ];

            // Reset variables for this execution (already declared at top scope)
            steps = 0;
            finalAnswer = '';
            const startTime = Date.now();
            confidence = 'Medium';
            explanation = { basis: 'Internal', assumptions: [], missing_info: [] };
            answerState = 'UNVERIFIED';
            answerMode = 'internal';
            usedTools.clear();

            // === MAIN AGENT LOOP ===
            while (steps < AGENT_CONFIG.MAX_STEPS) {
                // Wall-clock timeout protection
                if (Date.now() - startTime > AGENT_CONFIG.MAX_WALL_MS) {
                    LoggerService.warn('agent_timeout', { steps, elapsed: Date.now() - startTime, traceId }, userId);
                    finalAnswer = 'ขออภัยครับ คำขอใช้เวลาเกินกำหนด กรุณาลองถามใหม่อีกครั้ง';
                    answerMode = 'internal';
                    answerState = 'TIMEOUT';
                    break;
                }

                // Client disconnected — stop processing
                if (clientDisconnected) {
                    LoggerService.info('agent_client_disconnected', { steps, traceId }, userId);

                    const stoppedMessage = {
                        role: 'assistant' as const,
                        content: '*(Conversation stopped by user)*',
                        timestamp: new Date(),
                        meta: {
                            stepsUsed: steps,
                            stopReason: 'user_abort'
                        }
                    };
                    await HistoryService.addMessage(userId, sessionId, stoppedMessage);
                    await HistoryService.saveToPersistentStorage(userId, sessionId, [stoppedMessage], { totalTokens: totalUsage.total }, process.env.ENV_TYPE || 'TEST', MODELS.PRIMARY);

                    return;
                }

                steps++;
                LoggerService.info('agent_step', { step: steps, sessionId, traceId }, userId);

                // Diagnostic: log message structure before sending (only on step 1)
                if (steps === 1) {
                    const msgStructure = messages.map((m: any, i: number) => ({
                        idx: i,
                        role: m.role,
                        contentType: typeof m.content,
                        isArray: Array.isArray(m.content),
                        blockTypes: Array.isArray(m.content)
                            ? m.content.map((b: any) => b?.type || (b ? Object.keys(b)[0] : 'unknown'))
                            : undefined,
                        contentLength: typeof m.content === 'string' ? m.content.length : undefined,
                        contentPreview: Array.isArray(m.content)
                            ? m.content.map((b: any) => ({
                                type: b?.type,
                                hasText: !!b?.text,
                                hasToolUse: !!b?.toolUse,
                                hasToolResult: !!b?.toolResult,
                                toolUseId: b?.toolUseId
                            }))
                            : typeof m.content === 'string' ? m.content.substring(0, 100) : undefined
                    }));
                    LoggerService.info('agent_messages_structure', {
                        totalMessages: messages.length,
                        structure: msgStructure
                    }, userId);
                }

                // Reset per-step variables
                let stepUsage = { input: 0, output: 0, total: 0 };
                contentBlocks = [];
                fullResponse = '';
                stopReason = '';

                // Buffer for constructing blocks from stream
                let currentBlock: any = null;
                let currentBlockIndex = -1;

                const stream = BedrockService.streamChatGenerator(
                    MODELS.PRIMARY,
                    messages,
                    systemBlocks,
                    0.5,
                    toolConfig,
                    guardrailConfig
                );

                let chunkCount = 0;

                // === FIXED STREAMING LOGIC ===
                try {
                    // Bedrock Service sends events as: { type: '...', ... }
                    for await (const chunk of stream) {
                        // Safety check: skip if chunk is null/undefined
                        if (!chunk) {
                            LoggerService.warn('stream_chunk_null', { step: steps, chunkCount }, userId);
                            continue;
                        }

                        chunkCount++;

                        // Debug first few chunks
                        if (steps === 1 && chunkCount <= 3) {
                            LoggerService.info('stream_chunk_debug', {
                                chunkNum: chunkCount,
                                type: chunk.type,
                                keys: Object.keys(chunk).slice(0, 10),
                                hasText: !!chunk.text,
                                hasDelta: !!chunk.delta,
                                fullChunk: JSON.stringify(chunk).substring(0, 200)
                            }, userId);
                        }

                        // 1. Message Start Event
                        if (chunk.type === 'message_start') {
                            if (chunk.message?.usage) {
                                stepUsage.input += (chunk.message.usage.inputTokens || 0);
                            }
                        }

                        // 2. Content Block Start Event
                        else if (chunk.type === 'content_block_start') {
                            currentBlockIndex = chunk.index;
                            const start = chunk.start;

                            // Initialize block based on type
                            if (start.start?.toolUse) {
                                currentBlock = {
                                    type: 'tool_use',
                                    id: start.start.toolUse.toolUseId,
                                    name: start.start.toolUse.name,
                                    input: '', // Will accumulate JSON string
                                    toolUseId: start.start.toolUse.toolUseId
                                };
                            } else {
                                currentBlock = {
                                    type: 'text',
                                    text: ''
                                };
                            }

                            contentBlocks[currentBlockIndex] = currentBlock;
                        }

                        // 3. Content Block Delta Event
                        else if (chunk.type === 'content_block_delta') {
                            // Bedrock Service provides chunk.text as convenience
                            if (chunk.text) {
                                if (currentBlock && currentBlock.type === 'text') {
                                    currentBlock.text += chunk.text;
                                }
                                fullResponse += chunk.text;

                                // STREAM TO CLIENT
                                if (enableStream) {
                                    safeWrite(`data: ${JSON.stringify({ type: 'token', text: chunk.text })}\n\n`);
                                }
                            }
                            // Tool use input accumulation
                            else if (chunk.delta?.toolUse?.input) {
                                if (currentBlock && currentBlock.type === 'tool_use') {
                                    currentBlock.input += chunk.delta.toolUse.input;
                                }
                            }
                        }

                        // 4. Content Block Stop Event
                        else if (chunk.type === 'content_block_stop') {
                            // Parse tool input JSON if needed
                            if (currentBlock && currentBlock.type === 'tool_use') {
                                try {
                                    if (typeof currentBlock.input === 'string') {
                                        currentBlock.input = JSON.parse(currentBlock.input);
                                    }
                                } catch (e) {
                                    LoggerService.warn('tool_input_parse_error', {
                                        tool: currentBlock.name,
                                        input: currentBlock.input
                                    }, userId);
                                }
                            }
                            currentBlock = null;
                            currentBlockIndex = -1;
                        }

                        // 5. Message Stop Event
                        else if (chunk.type === 'message_stop') {
                            stopReason = chunk.stopReason;
                        }

                        // 6. Usage Metadata Event
                        else if (chunk.type === 'usage') {
                            if (chunk.usage) {
                                stepUsage.input = chunk.usage.input || stepUsage.input;
                                stepUsage.output = chunk.usage.output || 0;
                                stepUsage.total = chunk.usage.total || (stepUsage.input + stepUsage.output);
                            }
                        }
                    }

                } catch (streamError: any) {
                    LoggerService.error('stream_processing_error', {
                        step: steps,
                        chunkCount,
                        error: streamError.message,
                        stack: streamError.stack,
                        name: streamError.name,
                        code: streamError.code
                    }, userId);
                    throw streamError; // Re-throw to be caught by outer try-catch
                }

                LoggerService.info('stream_complete', {
                    step: steps,
                    totalChunks: chunkCount,
                    contentBlocks: contentBlocks.length,
                    fullResponseLength: fullResponse.length,
                    stopReason
                }, userId);

                LoggerService.info('agent_model_response', {
                    step: steps,
                    stopReason,
                    responseLength: fullResponse?.length,
                    rawResponsePreview: fullResponse?.substring(0, 200)
                }, userId);

                // Update total usage
                totalUsage.input += stepUsage.input;
                totalUsage.output += stepUsage.output;
                totalUsage.total += stepUsage.total;

                // Handle Response
                if (stopReason === 'tool_use') {
                    const toolBlocks = contentBlocks.filter(b => !!b && b.type === 'tool_use');
                    LoggerService.info('agent_tool_use_detected', {
                        step: steps,
                        toolCount: toolBlocks.length,
                        tools: toolBlocks.map(b => ({ name: b.name, id: b.id || b.toolUseId }))
                    }, userId);

                    messages.push({ role: 'assistant', content: contentBlocks });

                    const toolResults: any[] = [];
                    for (const block of contentBlocks) {
                        if (!block) continue;
                        if (block.type === 'tool_use') {
                            const toolName = block.name;
                            const toolUseId = block.toolUseId || block.id;
                            const toolInput = block.input;

                            usedTools.add(toolName);

                            LoggerService.info('tool_execution_start', {
                                tool: toolName,
                                toolUseId,
                                input: toolInput
                            }, userId);
                            safeWrite(`data: ${JSON.stringify({ type: 'status', message: `Using ${toolName}...` })}\n\n`);

                            const tool = allowedTools.find(t => t.schemaJSON.name === toolName);
                            let resultContent: any;

                            if (tool) {
                                try {
                                    LoggerService.info('agent_executing_tool', {
                                        tool: toolName,
                                        input: toolInput,
                                        context: { userId, role: userRole, department: userDepartment, collectionId }
                                    }, userId);

                                    const executionResult = await tool.execute(toolInput, {
                                        userId,
                                        role: userRole,
                                        department: userDepartment,
                                        collectionId
                                    });

                                    resultContent = executionResult.success ? executionResult.result : `Error: ${executionResult.error}`;

                                    LoggerService.info('agent_tool_result', {
                                        tool: toolName,
                                        success: executionResult.success,
                                        resultLength: resultContent?.length,
                                        resultPreview: typeof resultContent === 'string'
                                            ? resultContent.substring(0, 200)
                                            : JSON.stringify(resultContent).substring(0, 200)
                                    }, userId);
                                } catch (toolError: any) {
                                    LoggerService.error('tool_execution_error', {
                                        tool: toolName,
                                        error: toolError.message,
                                        stack: toolError.stack,
                                        code: toolError.code
                                    }, userId);
                                    resultContent = `Error: ${toolError.message}`;
                                }
                            } else {
                                LoggerService.warn('tool_not_found', { toolName, availableTools: allowedTools.map(t => t.schemaJSON.name) }, userId);
                                resultContent = `Error: Tool ${toolName} not found.`;
                            }

                            toolResults.push({
                                toolUseId: toolUseId,
                                content: [{ json: { result: resultContent } }]
                            });
                        }
                    }

                    // Log tool results before sending back to model
                    LoggerService.info('tool_results_prepared', {
                        step: steps,
                        resultCount: toolResults.length,
                        results: toolResults.map(tr => ({
                            toolUseId: tr.toolUseId,
                            contentType: tr.content[0].json ? 'json' : 'unknown',
                            resultPreview: JSON.stringify(tr.content[0]).substring(0, 200)
                        }))
                    }, userId);

                    messages.push({
                        role: 'user',
                        content: toolResults.map(tr => ({
                            type: 'tool_result',
                            toolUseId: tr.toolUseId,
                            content: tr.content
                        }))
                    });

                } else {
                    // Final Answer
                    let textContent = '';

                    if (contentBlocks.length > 0) {
                        textContent = contentBlocks.filter(b => !!b && b.type === 'text').map(b => b.text).join('\n');
                    } else {
                        // Fallback if contentBlocks wasn't populated (shouldn't happen with fixed streaming)
                        textContent = fullResponse;
                    }

                    finalAnswer = textContent;

                    // Determine answer mode
                    if (nativeDocBlocks.length > 0 || extractedTextBlocks.length > 0) {
                        answerMode = 'file_grounded';
                        answerState = 'VERIFIED';
                        confidence = 'High';
                        explanation = { basis: 'Attached Files', assumptions: [], missing_info: [] };
                    } else if (usedTools.has('search')) {
                        answerMode = 'rag';
                        answerState = 'VERIFIED';
                        confidence = 'High';
                        explanation = { basis: 'RAG Search', assumptions: [], missing_info: [] };
                    } else {
                        answerMode = 'internal';
                        answerState = 'UNVERIFIED';
                        confidence = 'Medium';
                        explanation = { basis: 'Internal Knowledge', assumptions: [], missing_info: [] };
                    }

                    break;
                }
            }

            // === END LOOP ===

            // 6. Streaming Final Answer
            if (finalAnswer) {
                // If NOT streaming, send the full text now
                if (!enableStream) {
                    safeWrite(`data: ${JSON.stringify({ text: finalAnswer, traceId })}\n\n`);
                }

                safeWrite(`data: ${JSON.stringify({
                    type: 'metadata',
                    metadata: {
                        answer_mode: answerMode,
                        answer_state: answerState,
                        usedRAG: answerMode !== 'internal',
                        stepsUsed: steps,
                        totalTokens: totalUsage.total,
                        confidence,
                        explanation
                    }
                })}\n\n`);
                safeWrite(`data: ${JSON.stringify({ type: 'status', message: '' })}\n\n`);
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
                    }
                };

                await HistoryService.addMessage(userId, sessionId, assistantMessage);
                await HistoryService.saveToPersistentStorage(userId, sessionId, [assistantMessage], { totalTokens: totalUsage.total }, process.env.ENV_TYPE || 'TEST', MODELS.PRIMARY);

                // Log Token Usage for Dashboard
                await LoggerService.info('chat_completion', {
                    tokens: totalUsage,
                    model: MODELS.PRIMARY,
                    steps,
                    sessionId,
                    traceId
                }, userId);

                // 8. Background Summarization (fire-and-forget)
                // Note: We don't re-save user message since it was saved at start
                SummarizationService.runUpdate(userId, sessionId, [assistantMessage], smartContext || {
                    canonical: '', rolling: { facts: [], intent: { primary: 'QUERY', confidence: 1 }, constraints: [], decisions: [], open_questions: [], confidence_score: 1 },
                    version: 0, hashes: { canonical: '', rolling: '', raw: '' }, lastCanonizedAt: new Date()
                }).catch((e: any) => LoggerService.error('Background Summary Failed', e));

                // 9. Auto-Title Generation (First Turn Only)
                if (history.length === 0) {
                    try {
                        const newTitle = await SummarizationService.updateTitle(userId, sessionId, query);
                        if (newTitle) {
                            safeWrite(`data: ${JSON.stringify({ type: 'title', title: newTitle })}\n\n`);
                        }
                    } catch (e: any) {
                        LoggerService.error('Title Gen Failed', e);
                    }
                }
            }

        } catch (error: any) {
            LoggerService.error('Agent Workflow Error', {
                error: error.message,
                stack: error.stack,
                name: error.name,
                cause: error.cause,
                traceId
            }, userId);

            // Log detailed error info
            console.error('[AgentWorkflow] Detailed Error:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                code: error.code,
                statusCode: error.statusCode,
                response: error.response?.data,
                config: error.config ? {
                    url: error.config.url,
                    method: error.config.method
                } : undefined
            });

            if (!clientDisconnected && !res.writableEnded) {
                safeWrite(`data: ${JSON.stringify({
                    type: 'error',
                    error: 'Agent workflow failed',
                    message: error.message,
                    traceId
                })}\n\n`);
                res.end();
            }
        }
    }

}