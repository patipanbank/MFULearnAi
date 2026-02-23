import { AgentEventStore } from '../services/AgentEventStore';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { CalculatorTool } from '../tools/CalculatorTool';
import { SearchTool } from '../tools/SearchTool';
import { PolicyCheckerTool } from '../tools/PolicyCheckerTool';
import { SYSTEM_MODELS } from '../config/models';
import * as crypto from 'crypto';

// New Components & Types
import { AgentContext, WorkflowState, AGENT_EVENTS, AgentPhase } from './types/AgentTypes';
import { AGENT_CONSTANTS } from './types/AgentConstants';
import { FileProcessor } from './components/FileProcessor';
import { PromptBuilder } from './components/PromptBuilder';
import { ToolExecutor } from './components/ToolExecutor';
import { ContextLoader } from './components/ContextLoader';
import { ResultPersister } from './components/ResultPersister';

import { AgentTool } from '../tools/AgentTool';
import { ToolAccessService } from '../services/ToolAccessService';

// Whitelist of tools for the Agent
const AVAILABLE_TOOLS: AgentTool[] = [
    new CalculatorTool(),
    new SearchTool(),
    new PolicyCheckerTool()
];

import { mcpManager } from '../mcp/McpManager';
import path from 'path';

export class AgentWorkflow {
    private ctx: AgentContext;
    private state: WorkflowState;
    private store: AgentEventStore;

    private constructor(ctx: AgentContext) {
        this.ctx = ctx;
        const traceId = ctx.traceId || crypto.randomUUID();
        this.state = {
            phase: AgentPhase.INIT,
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
            messages: [],
            toolOutputs: [],
            scratchpad: [],
            tokenUsage: { input: 0, output: 0, total: 0 },
            hasEmittedAnswerStart: false
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
        traceId?: string,
        modelId?: string
    ): Promise<{ traceId: string }> {
        const workflow = new AgentWorkflow({
            userId, sessionId, message, userRole, userDepartment, collectionId, modelId, images, files, traceId
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
            // 1. Load Context
            this.state.phase = AgentPhase.INIT;
            // Yield to ensure AGENT_START is flushed
            await new Promise(resolve => setTimeout(resolve, 0));

            const contextResult = await ContextLoader.loadContext(
                this.ctx,
                this.emit.bind(this)
            );
            this.state.history = contextResult.history;
            this.state.smartContext = contextResult.smartContext;

            // 2. Process Files
            this.state.phase = AgentPhase.UPLOADING;

            // 2.1 Process Inline Images (Persist them)
            const imageUploadPromises: Promise<any>[] = [];
            if (this.ctx.images && this.ctx.images.length > 0) {
                this.ctx.images.forEach((img: any, idx: number) => {
                    if (img.source && img.source.bytes) {
                        const p = (async () => {
                            try {
                                const buffer = Buffer.from(img.source.bytes, 'base64');
                                const format = img.format || 'png';
                                const fileName = `image-${Date.now()}-${idx}.${format}`;
                                const { ChatAttachmentService } = await import('../services/ChatAttachmentService');
                                return await ChatAttachmentService.uploadFile(
                                    buffer,
                                    fileName,
                                    `image/${format}`,
                                    this.ctx.userId
                                );
                            } catch (e: any) {
                                LoggerService.error('image_persist_error', { error: e.message });
                                return null;
                            }
                        })();
                        imageUploadPromises.push(p);
                    }
                });
            }

            // 2.2 Process Files (OCR + Upload)
            const fileJob = await FileProcessor.processFiles(
                this.ctx.files,
                this.ctx.userId,
                this.emit.bind(this)
            );

            // Wait for OCR
            if (fileJob.status === 'pending') {
                this.state.phase = AgentPhase.OCR_WAIT;
                this.emit(AGENT_EVENTS.STATUS, { message: 'Waiting for OCR processing...' });
                const completedJob = await FileProcessor.waitForJob(
                    fileJob.jobId,
                    this.emit.bind(this),
                    AGENT_CONSTANTS.OCR_JOB_TIMEOUT
                );

                if (completedJob.status === 'failed') {
                    LoggerService.warn('OCR Job Failed', { jobId: fileJob.jobId }, this.ctx.userId);
                } else {
                    fileJob.extractedTextBlocks.push(...completedJob.extractedTextBlocks);
                }
            }

            this.state.nativeDocBlocks = fileJob.nativeDocBlocks;
            this.state.extractedTextBlocks = fileJob.extractedTextBlocks;

            // Merge file uploads and image uploads for persistence
            const fileUploadPromises = fileJob.attachments.map(a => Promise.resolve(a));
            this.state.uploadPromises = [...fileUploadPromises, ...imageUploadPromises];

            // 3. Initialize Tools (General + MCP)
            this.state.phase = AgentPhase.INIT;
            const mcpTools = mcpManager.getTools();
            const allTools = [...AVAILABLE_TOOLS, ...mcpTools];

            // 3.1 Filter tools by user role (DB override > code defaults)
            const userRole = this.ctx.userRole;
            const allowedTools = await ToolAccessService.filterAllowed(allTools, userRole);

            // 4. Build Prompt & Initial Messages
            this.state.phase = AgentPhase.PLANNING;
            this.state.messages = await PromptBuilder.buildInitialMessages(this.ctx, this.state, allowedTools);

            // 5. Main Agent Loop
            await this.agentLoop(allowedTools);

            this.state.phase = AgentPhase.COMPLETED;

        } catch (error: any) {
            this.state.phase = AgentPhase.FAILED;
            LoggerService.error('Agent Workflow Error', {
                error: error.message,
                stack: error.stack,
                traceId: this.state.traceId
            });
            // Final Answer fallback for errors
            this.state.finalAnswer = 'เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง';
            this.state.answerMode = 'internal';
            this.state.answerState = 'ERROR';

            // Emit error block so frontend bubble shows the error message
            this.emit(AGENT_EVENTS.BLOCK_START, { answerMode: 'internal', step: this.state.steps });
            this.emit(AGENT_EVENTS.BLOCK_DELTA, { delta: this.state.finalAnswer });
            this.emit(AGENT_EVENTS.BLOCK_END, { step: this.state.steps });
            this.emit(AGENT_EVENTS.ERROR, { error: 'Agent workflow failed', traceId: this.state.traceId });
        } finally {
            // 5. Finalize & Persist
            await ResultPersister.finalize(
                this.ctx,
                this.state,
                this.emit.bind(this),
                this.store
            );
        }

        return { traceId: this.state.traceId };
    }

    /**
     * Main Agent Loop
     */
    private async agentLoop(allowedTools: AgentTool[]) {
        const toolConfig = allowedTools.length > 0 ? {
            tools: allowedTools.map(t => ({ toolSpec: t.schemaJSON }))
        } : undefined;

        const guardrailConfig = process.env.BEDROCK_GUARDRAIL_ID ? {
            guardrailIdentifier: process.env.BEDROCK_GUARDRAIL_ID,
            guardrailVersion: process.env.BEDROCK_GUARDRAIL_VERSION || 'DRAFT'
        } : undefined;

        while (this.state.steps < AGENT_CONSTANTS.MAX_AGENT_STEPS) {
            // Check Timeout
            if (Date.now() - this.state.startTime > AGENT_CONSTANTS.AGENT_TIMEOUT_MS) {
                this.handleTimeout();
                break;
            }
            if (this.state.clientDisconnected) return;

            this.state.steps++;
            this.emit(AGENT_EVENTS.AGENT_STEP, { step: this.state.steps, maxSteps: AGENT_CONSTANTS.MAX_AGENT_STEPS });

            LoggerService.info('agent_step', { step: this.state.steps, traceId: this.state.traceId }, this.ctx.userId);

            const stepStartTime = Date.now();
            let firstTokenTime: number | null = null;
            let currentBlockText = '';
            let hasEmittedBlockStart = false;

            this.state.phase = AgentPhase.GENERATING_RESPONSE;

            // --- STREAMING CALL ---
            const { text: fullResponse, content: contentBlocks, usage: stepUsage, stopReason } = await BedrockService.streamChatSSE(
                SYSTEM_MODELS.AGENT,
                this.state.messages as any,
                (delta) => {
                    if (!firstTokenTime) firstTokenTime = Date.now();

                    currentBlockText += delta;

                    if (!hasEmittedBlockStart) {
                        this.determineAnswerMode(delta); // Quick peek, though better to do it earlier or post-hoc
                        this.emit(AGENT_EVENTS.BLOCK_START, { answerMode: this.state.answerMode, step: this.state.steps });
                        hasEmittedBlockStart = true;
                    }

                    this.emit(AGENT_EVENTS.BLOCK_DELTA, { delta });
                },
                0.5,
                toolConfig,
                guardrailConfig
            );

            // If we generated any text, close the block naturally
            if (hasEmittedBlockStart) {
                this.emit(AGENT_EVENTS.BLOCK_END, { step: this.state.steps });
            }

            // Update Usage
            const stepDurationMs = Date.now() - stepStartTime;
            const ttftMs = firstTokenTime ? firstTokenTime - stepStartTime : null;

            LoggerService.info('agent_model_response_metrics', {
                step: this.state.steps,
                traceId: this.state.traceId,
                ttftMs,
                totalDurationMs: stepDurationMs,
                model: SYSTEM_MODELS.AGENT
            }, this.ctx.userId);

            this.updateUsage(stepUsage, stepDurationMs);

            // Logic: Tool Use vs Final Answer
            if (stopReason === 'tool_use') {
                this.state.phase = AgentPhase.EXECUTING_TOOL;

                const { usedTools, toolResults } = await ToolExecutor.executeTools(
                    fullResponse,
                    contentBlocks,
                    allowedTools,
                    this.ctx,
                    this.state.steps,
                    this.emit.bind(this)
                );

                usedTools.forEach(t => this.state.usedTools.add(t));
                // Add Assistant Response (Tool Use request)
                this.state.messages.push({ role: 'assistant', content: contentBlocks || [{ type: 'text', text: fullResponse }] });

                // Add Tool Results
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

            } else {
                this.state.phase = AgentPhase.COMPLETED;
                // Final Answer Logic (Claude Native Block Streaming handles this naturally)

                // 3. Update State & Emit DONE
                this.state.finalAnswer = fullResponse;
                this.state.messages.push({ role: 'assistant', content: fullResponse });

                break;
            }
        }
    }

    private determineAnswerMode(response: string) {
        if (this.state.nativeDocBlocks.length > 0) {
            this.state.answerMode = 'file_grounded';
            this.state.answerState = 'VERIFIED';
        } else if (this.state.usedTools.has('check_policy')) {
            this.state.answerMode = 'policy_grounded';
            this.state.answerState = 'VERIFIED';
        } else if (this.state.usedTools.has('search')) {
            this.state.answerMode = 'rag';
            this.state.answerState = 'VERIFIED';
        } else {
            this.state.answerMode = 'internal';
            this.state.answerState = 'UNVERIFIED';
        }
    }

    private handleTimeout() {
        LoggerService.warn('agent_timeout', { steps: this.state.steps, traceId: this.state.traceId }, this.ctx.userId);
        this.state.finalAnswer = 'ขออภัยครับ คำขอใช้เวลาเกินกำหนด กรุณาลองถามใหม่อีกครั้ง';
        this.state.answerMode = 'internal';
        this.state.answerState = 'TIMEOUT';

        // Emit answer events so frontend bubble shows the timeout message
        this.emit(AGENT_EVENTS.BLOCK_START, { answerMode: 'internal', step: this.state.steps });
        this.emit(AGENT_EVENTS.BLOCK_DELTA, { delta: this.state.finalAnswer });
        this.emit(AGENT_EVENTS.BLOCK_END, { step: this.state.steps });
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
}
