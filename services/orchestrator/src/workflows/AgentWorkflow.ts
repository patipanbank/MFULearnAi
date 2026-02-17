import { HistoryService } from '../services/HistoryService';
import { AgentEventStore } from '../services/AgentEventStore';
import { KnowledgeService } from '../services/KnowledgeService';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { SummarizationService } from '../services/SummarizationService';
import { ChatAttachmentService } from '../services/ChatAttachmentService';
import { CalculatorTool } from '../tools/CalculatorTool';
import { SearchTool } from '../tools/SearchTool';
import { MODELS, AGENT_CONFIG } from '../config/models';
import * as crypto from 'crypto';

// Whitelist of tools for the Agent
const AVAILABLE_TOOLS = [
    new CalculatorTool(),
    new SearchTool()
];

// ── SSE Event Type Constants ──
export const AGENT_EVENTS = {
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

interface AgentContext {
    userId: string;
    sessionId: string;
    message: string;
    userRole: string;
    userDepartment: string;
    collectionId?: string;
    images: any[];
    files: any[];
    traceId?: string;
}

interface WorkflowState {
    traceId: string;
    steps: number;
    totalUsage: { input: 0, output: 0, total: 0 };
    usedTools: Set<string>;
    answerMode: string;
    answerState: string;
    startTime: number;
    finalAnswer: string;
    history: any[];
    smartContext: any;
    nativeDocBlocks: any[];
    extractedTextBlocks: any[];
    uploadPromises: Promise<any>[];
    clientDisconnected: boolean;
    messages: any[];
}

export class AgentWorkflow {
    private ctx: AgentContext;
    private state: WorkflowState; private store: AgentEventStore;

    private constructor(ctx: AgentContext) {
        this.ctx = ctx;
        const traceId = ctx.traceId || crypto.randomUUID();
        this.state = {
            traceId,
            steps: 0,
            totalUsage: { input: 0, output: 0, total: 0 },
            usedTools: new Set<string>(),
            answerMode: 'internal',
            answerState: 'UNVERIFIED',
            startTime: Date.now(),
            finalAnswer: '',
            history: [],
            smartContext: null,
            nativeDocBlocks: [],
            extractedTextBlocks: [],
            uploadPromises: [],
            clientDisconnected: false,
            messages: []
        };

        // Initialize Event Store
        this.store = new AgentEventStore(ctx.userId, traceId);
    }

    /**
     * Public Entry Point
     */
    static async execute(
        userId: string,
        sessionId: string,
        message: string,
        userRole: string,
        userDepartment: string,
        collectionId: string | undefined,
        images: any[] = [],
        files: any[] = [],
        traceId?: string
    ): Promise<{ traceId: string }> {
        const workflow = new AgentWorkflow({
            userId, sessionId, message, userRole, userDepartment, collectionId, images, files, traceId
        });
        return workflow.run();
    }

    private emit(type: string, payload: Record<string, any> = {}) {
        this.store.emit(type, payload);
    }


    private async run(): Promise<{ traceId: string }> {
        LoggerService.info('agent_workflow_start', {
            traceId: this.state.traceId,
            userId: this.ctx.userId,
            message: this.ctx.message
        }, this.ctx.userId);

        this.emit(AGENT_EVENTS.AGENT_START, {
            traceId: this.state.traceId,
            sessionId: this.ctx.sessionId
        });

        try {
            // 1. Load Context & Files
            // Yield to ensure AGENT_START is flushed
            await new Promise(resolve => setTimeout(resolve, 0));

            await this.loadContext();
            await this.processFiles();

            // 2. Build Prompt & Initial Messages
            this.buildInitialMessages();

            // 3. Main Agent Loop
            await this.agentLoop();

            // 4. Finalize & Persist
            await this.finalize();

        } catch (error: any) {
            LoggerService.error('Agent Workflow Error', {
                error: error.message,
                stack: error.stack,
                traceId: this.state.traceId
            });
            this.emit('error', { error: 'Agent workflow failed', traceId: this.state.traceId });
        }

        return { traceId: this.state.traceId };
    }

    /**
     * 1. Load History & Smart Context
     */
    private async loadContext() {
        this.emit(AGENT_EVENTS.STATUS, { message: 'กำลังโหลดบริบทการสนทนา...' });
        const { messages: history, smartContext } = await HistoryService.getContext(
            this.ctx.userId,
            this.ctx.sessionId
        );
        this.state.history = history;
        this.state.smartContext = smartContext;

        this.emit(AGENT_EVENTS.CONTEXT_LOADED, {
            historyCount: history.length,
            hasSmartContext: !!smartContext,
            smartContextVersion: smartContext?.version || 0
        });
    }

    /**
     * 2. Process Files (Native Docs & Text Extraction)
     */
    private async processFiles() {
        const { files, userId } = this.ctx;
        if (!files || files.length === 0) return;

        LoggerService.info('agent_files_received', {
            filesCount: files.length,
            fileDetails: files.map((f: any) => ({
                name: f.originalname || f.name,
                size: f.size,
                hasBuffer: !!f.buffer
            }))
        }, userId);

        const MAX_NATIVE_SIZE = 4.5 * 1024 * 1024;
        const MAX_EXTRACTED_TEXT_CHARS = 100_000;
        const supportedFormats = ['pdf', 'txt', 'md', 'html', 'csv', 'doc', 'docx', 'xls', 'xlsx'];
        const totalFiles = files.length;

        for (let fi = 0; fi < files.length; fi++) {
            const file = files[fi];
            const fileName = file.originalname || file.name || 'file';
            const fileSizeMB = ((file.buffer?.length || 0) / (1024 * 1024)).toFixed(1);

            const emitProgress = (stage: string, percent: number, detail?: string) => {
                this.emit(AGENT_EVENTS.FILE_PROGRESS, {
                    fileName, fileIndex: fi, totalFiles, stage, percent, detail: detail || ''
                });
            };

            emitProgress('preparing', 5, `${fileSizeMB} MB`);

            if (!file.buffer) {
                emitProgress('error', 0, 'ไม่พบข้อมูลไฟล์');
                continue;
            }

            const ext = (fileName).split('.').pop()?.toLowerCase() || 'pdf';
            if (!supportedFormats.includes(ext)) {
                emitProgress('error', 0, `ไม่รองรับไฟล์ .${ext}`);
                continue;
            }

            // Start background upload
            this.state.uploadPromises.push(
                ChatAttachmentService.uploadFile(file.buffer, fileName, file.mediaType || 'application/pdf', userId)
                    .then(meta => {
                        this.emit(AGENT_EVENTS.FILE_UPLOADED, { fileName, metadata: meta });
                        return { ...meta, fileType: ext };
                    })
                    .catch(err => {
                        LoggerService.warn('file_upload_background_failed', { fileName, error: err.message }, userId);
                        return null;
                    })
            );

            if (file.buffer.length < MAX_NATIVE_SIZE) {
                // Native Block
                emitProgress('encoding', 50, 'กำลังเข้ารหัสเอกสาร...');
                const rawName = this.sanitizeFileName(fileName);

                this.state.nativeDocBlocks.push({
                    type: 'document',
                    format: ext,
                    name: rawName,
                    data: Buffer.from(file.buffer).toString('base64')
                });

                emitProgress('done', 100, 'พร้อมส่ง');
            } else {
                // Large File Extraction
                emitProgress('extracting', 20, `กำลังดึงข้อความ (${fileSizeMB} MB)...`);

                try {
                    const ir = await KnowledgeService.parseFile(file.buffer, fileName, file.mediaType || 'application/pdf');

                    if (ir && ir.blocks && ir.blocks.length > 0) {
                        let fullText = ir.blocks.map((b: any) => b.content).join('\n\n');
                        if (fullText.length > MAX_EXTRACTED_TEXT_CHARS) {
                            fullText = fullText.substring(0, MAX_EXTRACTED_TEXT_CHARS) + '\n\n[... Truncated ...]';
                        }
                        this.state.extractedTextBlocks.push({ fileName, text: fullText });
                        emitProgress('done', 100, `ดึงข้อความสำเร็จ`);
                    } else {
                        emitProgress('error', 0, 'ไม่สามารถดึงข้อความได้');
                    }
                } catch (e: any) {
                    emitProgress('error', 0, 'การดึงข้อความล้มเหลว');
                }
            }
        }
    }

    /**
     * 3. Build System Prompt & Messages
     */
    private buildInitialMessages() {
        const { message, images } = this.ctx;
        const { smartContext, nativeDocBlocks, extractedTextBlocks, history } = this.state;

        // --- Logic: Refusal & Policy ---
        const isOrganizationalQuery = /policy|regulation|guideline|document|files|contract|agreement|budget|contact|email|who is|fee|calendar|schedule|deadline|registration|course|gpa|grade/i.test(message);
        const refusalRule = !isOrganizationalQuery
            ? `- Basic factual questions may be answered using internal knowledge.\n- WARNING: If the question pertains to specific organizational policies absent in context, you MUST use the Search tool.`
            : `- If the Knowledge Base or Context does not explicitly contain the answer, you MUST use the 'search' tool to find it. Do NOT say "I don't have enough information" without searching first.`;

        // --- Block 1: Persona & Rules ---
        const systemBlocks: Array<{ text: string }> = [];
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
- If the attached files or search results do NOT contain the answer, say so clearly. Do NOT guess.`
        });

        // --- Block 2: Session Context ---
        systemBlocks.push({
            text: `=== SESSION CONTEXT ===
${smartContext?.canonical || 'First session.'}
${JSON.stringify(smartContext?.rolling || {}, null, 2)}`
        });

        // --- Block 3: File Hints ---
        if (nativeDocBlocks.length > 0) {
            const names = nativeDocBlocks.map(d => d.name).join(', ');
            systemBlocks.push({ text: `The user has attached ${nativeDocBlocks.length} document(s): ${names}. They are included as native document blocks. Read them to answer.` });
        }
        if (extractedTextBlocks.length > 0) {
            const names = extractedTextBlocks.map(b => b.fileName).join(', ');
            systemBlocks.push({ text: `The user has attached ${extractedTextBlocks.length} large file(s): ${names}. The text has been extracted and included in the user message.` });
        }

        // --- Construct User Content ---
        const userContent: any[] = [];
        if (nativeDocBlocks.length > 0) userContent.push(...nativeDocBlocks);

        for (const etb of extractedTextBlocks) {
            userContent.push({
                type: 'text',
                text: `=== Extracted content from "${etb.fileName}" ===\n${etb.text}\n=== End of "${etb.fileName}" ===`
            });
        }

        userContent.push({ type: 'text', text: message });

        if (images && images.length > 0) {
            userContent.push(...images.map((img: any) => ({ type: 'image', source: img })));
        }

        // --- Final Message Stack ---
        this.state.messages = [
            { role: 'system', content: systemBlocks },
            ...history.slice(-10).map(m => ({ role: m.role, content: m.content, images: m.images })),
            { role: 'user', content: userContent }
        ];
    }

    /**
     * 4. Main Agent Loop
     */
    private async agentLoop() {
        const { userRole } = this.ctx;
        const allowedTools = AVAILABLE_TOOLS.filter(t => t.isAllowed(userRole));
        const toolConfig = allowedTools.length > 0 ? {
            tools: allowedTools.map(t => ({ toolSpec: t.schemaJSON }))
        } : undefined;

        const guardrailConfig = process.env.BEDROCK_GUARDRAIL_ID ? {
            guardrailIdentifier: process.env.BEDROCK_GUARDRAIL_ID,
            guardrailVersion: process.env.BEDROCK_GUARDRAIL_VERSION || 'DRAFT'
        } : undefined;

        while (this.state.steps < AGENT_CONFIG.MAX_STEPS) {
            // Check Timeout
            if (Date.now() - this.state.startTime > AGENT_CONFIG.MAX_WALL_MS) {
                this.handleTimeout();
                break;
            }
            if (this.state.clientDisconnected) return;

            this.state.steps++;
            this.emit(AGENT_EVENTS.AGENT_STEP, { step: this.state.steps, maxSteps: AGENT_CONFIG.MAX_STEPS });
            this.emit(AGENT_EVENTS.THINKING, { step: this.state.steps, message: `กำลังวิเคราะห์... (ขั้นตอนที่ ${this.state.steps})` });

            LoggerService.info('agent_step', { step: this.state.steps, traceId: this.state.traceId }, this.ctx.userId);

            const stepStartTime = Date.now();
            let firstTokenTime: number | null = null;

            // --- STREAMING CALL ---
            const { text: fullResponse, content: contentBlocks, usage: stepUsage, stopReason } = await BedrockService.streamChatSSE(
                MODELS.PRIMARY,
                this.state.messages,
                (delta) => {
                    if (!firstTokenTime) firstTokenTime = Date.now();
                    this.emit(AGENT_EVENTS.ANSWER_DELTA, { delta });
                },
                0.5,
                toolConfig,
                guardrailConfig
            );

            // Update Usage
            const stepDurationMs = Date.now() - stepStartTime;
            const ttftMs = firstTokenTime ? firstTokenTime - stepStartTime : null;

            LoggerService.info('agent_model_response_metrics', {
                step: this.state.steps,
                traceId: this.state.traceId,
                ttftMs,
                totalDurationMs: stepDurationMs,
                model: MODELS.PRIMARY
            }, this.ctx.userId);

            this.updateUsage(stepUsage, stepDurationMs);

            // Logic: Tool Use vs Final Answer
            if (stopReason === 'tool_use') {
                await this.handleToolExecution(fullResponse, contentBlocks, allowedTools);
            } else {
                // Final Answer
                this.handleFinalAnswer(fullResponse);
                break;
            }
        }
    }

    private async handleToolExecution(fullResponse: string, contentBlocks: any[], allowedTools: any[]) {
        const toolUseBlocks = contentBlocks && contentBlocks.length > 0
            ? contentBlocks
            : [{ type: 'text', text: fullResponse }];

        // Add Assistant Response to History
        this.state.messages.push({ role: 'assistant', content: toolUseBlocks });

        const toolResults: any[] = [];

        for (const block of toolUseBlocks) {
            if (block.type !== 'tool_use') continue;

            const { name: toolName, input: toolInput, toolUseId } = block;
            this.state.usedTools.add(toolName);

            LoggerService.info('tool_execution', { tool: toolName, input: toolInput }, this.ctx.userId);

            this.emit(AGENT_EVENTS.TOOL_START, { toolName, input: toolInput, step: this.state.steps });
            this.emit(AGENT_EVENTS.STATUS, { message: `🔧 Using ${toolName}...` });

            // Execute Tool
            const start = Date.now();
            const tool = allowedTools.find(t => t.schemaJSON.name === toolName);
            let result: any;
            let success = false;

            if (tool) {
                const exec = await tool.execute(toolInput, {
                    userId: this.ctx.userId,
                    role: this.ctx.userRole,
                    department: this.ctx.userDepartment,
                    collectionId: this.ctx.collectionId
                });
                result = exec.success ? exec.result : `Error: ${exec.error}`;
                success = exec.success;
                if (toolName === 'search' && success) this.state.usedTools.add('search');
            } else {
                result = `Error: Tool ${toolName} not found.`;
            }

            const duration = Date.now() - start;
            this.emit(AGENT_EVENTS.TOOL_COMPLETE, {
                toolName,
                success,
                resultPreview: typeof result === 'string' ? result.substring(0, 300) : JSON.stringify(result).substring(0, 300),
                durationMs: duration,
                step: this.state.steps
            });

            toolResults.push({
                toolUseId,
                content: [{ json: { result } }]
            });
        }

        // Add Tool Results to History
        if (toolResults.length > 0) {
            this.state.messages.push({
                role: 'user',
                content: toolResults.map(tr => ({
                    type: 'tool_result',
                    toolUseId: tr.toolUseId,
                    content: tr.content
                }))
            });
        }
    }

    private handleFinalAnswer(response: string) {
        this.state.finalAnswer = response;

        // Determine Answer Mode
        if (this.state.nativeDocBlocks.length > 0) {
            this.state.answerMode = 'file_grounded';
            this.state.answerState = 'VERIFIED';
        } else if (this.state.usedTools.has('search')) {
            this.state.answerMode = 'rag';
            this.state.answerState = 'VERIFIED';
        }

        this.emit(AGENT_EVENTS.ANSWER_START, { answerMode: this.state.answerMode });
        this.state.messages.push({ role: 'assistant', content: response });
        this.emit(AGENT_EVENTS.ANSWER_DONE, { fullLength: response.length });
    }

    /**
     * 5. Finalize, Persist, Summary
     */
    private async finalize() {
        if (!this.state.finalAnswer) return;

        const { finalAnswer, answerMode, answerState, steps, totalUsage, startTime } = this.state;
        const totalDurationMs = Date.now() - startTime;

        let confidence = 'Low';
        let explanation = { basis: 'Internal', assumptions: [], missing_info: [] };

        if (answerMode === 'file_grounded' || answerMode === 'rag') {
            confidence = 'High';
            explanation.basis = 'RAG';
        }

        this.emit(AGENT_EVENTS.METADATA, {
            metadata: {
                answer_mode: answerMode,
                answer_state: answerState,
                usedRAG: answerMode !== 'internal',
                stepsUsed: steps,
                totalTokens: totalUsage.total,
                explanation
            }
        });

        this.emit(AGENT_EVENTS.AGENT_COMPLETE, {
            totalSteps: steps,
            totalTokens: totalUsage.total,
            durationMs: totalDurationMs,
            toolsUsed: Array.from(this.state.usedTools),
            answerMode
        });

        this.emit(AGENT_EVENTS.STATUS, { message: '' });

        // -- Persistence --
        // Wait for file uploads
        const uploadedAttachments: any[] = [];
        if (this.state.uploadPromises.length > 0) {
            const results = await Promise.all(this.state.uploadPromises);
            results.forEach(r => r && uploadedAttachments.push(r));
        }

        const userMsgToSave: any = { role: 'user' as const, content: this.ctx.message, timestamp: new Date() };
        if (uploadedAttachments.length > 0) userMsgToSave.attachments = uploadedAttachments;

        const assistantMsgToSave = {
            role: 'assistant' as const,
            content: finalAnswer,
            timestamp: new Date(),
            meta: {
                stepsUsed: steps,
                answer_mode: answerMode,
                answer_state: answerState,
                confidence,
                explanation
            },
            agentEvents: this.store.getEventLog().map((e: any) => ({
                ...e, timestamp: new Date(e.timestamp)
            }))
        };

        const { userId, sessionId } = this.ctx;
        await HistoryService.addMessage(userId, sessionId, userMsgToSave);
        await HistoryService.addMessage(userId, sessionId, assistantMsgToSave);
        await HistoryService.saveToPersistentStorage(
            userId, sessionId,
            [userMsgToSave, assistantMsgToSave],
            { totalTokens: totalUsage.total },
            process.env.ENV_TYPE || 'TEST',
            MODELS.PRIMARY
        );

        LoggerService.info('chat_completion', {
            tokens: totalUsage, model: MODELS.PRIMARY, steps, sessionId, traceId: this.state.traceId
        }, userId);

        // Background Summary & Title
        SummarizationService.runUpdate(userId, sessionId, [userMsgToSave, assistantMsgToSave], this.state.smartContext || {
            canonical: '', rolling: { facts: [], intent: { primary: 'QUERY', confidence: 1 }, constraints: [], decisions: [], open_questions: [], confidence_score: 1 },
            version: 0, hashes: { canonical: '', rolling: '', raw: '' }, lastCanonizedAt: new Date()
        }).catch((e: any) => LoggerService.error('Background Summary Failed', e));

        if (this.state.history.length === 0) {
            SummarizationService.updateTitle(userId, sessionId, this.ctx.message)
                .then(title => title && this.emit(AGENT_EVENTS.TITLE, { title }))
                .catch(e => LoggerService.error('Title Gen Failed', e));
        }
    }

    private handleTimeout() {
        LoggerService.warn('agent_timeout', { steps: this.state.steps, traceId: this.state.traceId }, this.ctx.userId);
        this.state.finalAnswer = 'ขออภัยครับ คำขอใช้เวลาเกินกำหนด กรุณาลองถามใหม่อีกครั้ง';
        this.state.answerMode = 'internal';
        this.state.answerState = 'TIMEOUT';
        this.emit(AGENT_EVENTS.STATUS, { message: 'หมดเวลาดำเนินการ' });
    }

    private updateUsage(stepUsage: any, durationMs: number) {
        this.state.totalUsage.input += stepUsage.input;
        this.state.totalUsage.output += stepUsage.output;
        this.state.totalUsage.total += stepUsage.total;

        this.emit(AGENT_EVENTS.STEP_USAGE, {
            step: this.state.steps,
            input: stepUsage.input,
            output: stepUsage.output,
            total: stepUsage.total,
            durationMs
        });
    }


    private sanitizeFileName(name: string): string {
        return name
            .replace(/\.[^.]+$/, '')
            .replace(/[^a-zA-Z0-9\s\-\(\)\[\]]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim() || 'document';
    }
}
