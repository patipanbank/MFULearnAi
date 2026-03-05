import { AgentEventStore } from '../services/AgentEventStore';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { CalculatorTool } from '../tools/CalculatorTool';
import { SearchTool } from '../tools/SearchTool';
import { PolicyCheckerTool } from '../tools/PolicyCheckerTool';
import { TableLookupTool } from '../tools/TableLookupTool';
import { AskUserTool } from '../tools/AskUserTool';
import { StructuredQueryService } from '../services/StructuredQueryService';
import { SYSTEM_MODELS } from '../config/models';
import { getRecommendedTemperature } from '../config/ModelAdapter';
import * as crypto from 'crypto';
import { traceAsync, getMetrics } from '../infra/telemetry';

// Components & Types
import {
    AgentContext, AgentExecuteRequest, WorkflowState, BedrockMessage,
    AGENT_EVENTS, AgentPhase, TokenUsage, BedrockContentBlock
} from './types/AgentTypes';
import { AGENT_CONSTANTS, AGENT_MESSAGES } from './types/AgentConstants';
import { FileProcessor } from './components/FileProcessor';
import { PromptBuilder } from './components/PromptBuilder';
import { ToolExecutor } from './components/ToolExecutor';
import { ContextLoader } from './components/ContextLoader';
import { ResultPersister } from './components/ResultPersister';

import { AgentTool } from '../tools/AgentTool';
import { ToolAccessService } from '../services/ToolAccessService';

// Whitelist of built-in tools for the Agent
const AVAILABLE_TOOLS: AgentTool[] = [
    new CalculatorTool(),
    new SearchTool(),
    new PolicyCheckerTool(),
    new AskUserTool(),
];

import { mcpManager } from '../mcp/McpManager';

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
            hasEmittedAnswerStart: false,
            toolResultCache: new Map()
        };

        // Initialize Event Store with disconnect detection
        this.store = new AgentEventStore(ctx.userId, traceId);
        this.store.onDisconnect = () => {
            this.state.clientDisconnected = true;
            LoggerService.info('agent_client_disconnected', {
                traceId,
                step: this.state.steps
            }, ctx.userId);
        };
    }

    /**
     * Public Entry Point — accepts a single request object.
     */
    static async execute(request: AgentExecuteRequest): Promise<{ traceId: string }> {
        const ctx: AgentContext = {
            userId: request.userId,
            sessionId: request.sessionId,
            message: request.message,
            userRole: request.userRole,
            userDepartment: request.userDepartment,
            collectionId: request.collectionId,
            modelId: request.modelId,
            images: request.images || [],
            files: request.files || [],
            traceId: request.traceId,
            ...(request.apiKeyContext || {})
        };
        const workflow = new AgentWorkflow(ctx);
        return workflow.run();
    }

    private emit(type: string, payload: Record<string, unknown> = {}): void {
        this.store.emit(type, payload);
    }

    private async run(): Promise<{ traceId: string }> {
        return traceAsync('agent.workflow.run', async () => {
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
            const imageUploadPromises: Promise<unknown>[] = [];
            if (this.ctx.images && this.ctx.images.length > 0) {
                this.ctx.images.forEach((img, idx: number) => {
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
                            } catch (e: unknown) {
                                const message = e instanceof Error ? e.message : String(e);
                                LoggerService.error('image_persist_error', { error: message });
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
                this.emit(AGENT_EVENTS.STATUS, { message: AGENT_MESSAGES.STATUS_WAITING_OCR });
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
            const allTools: AgentTool[] = [...AVAILABLE_TOOLS, ...mcpTools];

            // 3.0.1 Conditionally inject TableLookupTool if collection has ANY structured data
            //       (including small "inject" tables — we no longer inject tables into the system prompt)
            if (this.ctx.collectionId) {
                try {
                    const [hasLookup, hasInjectable] = await Promise.all([
                        StructuredQueryService.collectionHasLookupStructuredData(this.ctx.collectionId),
                        StructuredQueryService.collectionHasInjectableData(this.ctx.collectionId)
                    ]);
                    if (hasLookup || hasInjectable) {
                        allTools.push(new TableLookupTool());
                        LoggerService.info('agent_structured_tool_injected', {
                            collectionId: this.ctx.collectionId,
                            mode: hasLookup ? 'lookup' : 'inject_via_tool',
                            traceId: this.state.traceId
                        });
                    }
                } catch (err: any) {
                    LoggerService.warn('agent_structured_tool_check_failed', { error: err.message });
                }
            }

            // 3.1 Filter tools by user role (DB override > code defaults)
            let allowedTools = await ToolAccessService.filterAllowed(allTools, this.ctx.userRole);

            // 3.2 Filter tools by API Key allowedTools (if API key request)
            if (this.ctx.isApiKey && this.ctx.allowedTools) {
                const apiToolScope = this.ctx.allowedTools;
                if (!apiToolScope.includes('*')) {
                    allowedTools = allowedTools.filter(t => {
                        const toolName = t.schemaJSON?.name || t.name;
                        return apiToolScope.includes(toolName);
                    });
                }
                if (apiToolScope.length === 0) {
                    allowedTools = [];
                }
            }

            // 4. Build Prompt & Initial Messages
            this.state.phase = AgentPhase.PLANNING;
            this.state.messages = await PromptBuilder.buildInitialMessages(this.ctx, this.state, allowedTools);

            // 4.1 Structured data is now always accessed via lookup_knowledge_table tool
            //     (no longer injected into system prompt to save tokens)

            // 5. Main Agent Loop
            await this.agentLoop(allowedTools);

            this.state.phase = AgentPhase.COMPLETED;

        } catch (error: unknown) {
            this.state.phase = AgentPhase.FAILED;
            const errMessage = error instanceof Error ? error.message : String(error);
            const errStack = error instanceof Error ? error.stack : undefined;
            LoggerService.error('Agent Workflow Error', {
                error: errMessage,
                stack: errStack,
                traceId: this.state.traceId
            });
            // Final Answer fallback for errors
            this.state.finalAnswer = AGENT_MESSAGES.ERROR_GENERIC;
            this.state.answerMode = 'internal';
            this.state.answerState = 'ERROR';

            // Emit error block so frontend bubble shows the error message
            this.emit(AGENT_EVENTS.BLOCK_START, { answerMode: 'internal', step: this.state.steps });
            this.emit(AGENT_EVENTS.BLOCK_DELTA, { delta: this.state.finalAnswer });
            this.emit(AGENT_EVENTS.BLOCK_END, { step: this.state.steps });
            this.emit(AGENT_EVENTS.ERROR, { error: 'Agent workflow failed', traceId: this.state.traceId });
        } finally {
            // 6. Finalize & Persist
            await ResultPersister.finalize(
                this.ctx,
                this.state,
                this.emit.bind(this),
                this.store
            );
        }

        return { traceId: this.state.traceId };
        }, { traceId: this.state.traceId, userId: this.ctx.userId }); // end traceAsync
    }

    // ── LLM Call with Exponential Backoff Retry ──────────────────────────────

    /**
     * Calls BedrockService.streamWithCallback with retry logic.
     * Retries on transient errors (throttling, 5xx, network) with exponential backoff.
     */
    private async streamWithRetry(
        messages: BedrockMessage[],
        onDelta: (delta: string) => void,
        toolConfig?: { tools: Array<{ toolSpec: unknown }> },
        guardrailConfig?: { guardrailIdentifier: string; guardrailVersion: string }
    ): Promise<{ text: string; content: BedrockContentBlock[]; usage: TokenUsage; stopReason?: string }> {
        const maxRetries = AGENT_CONSTANTS.LLM_MAX_RETRIES;
        const baseDelay = AGENT_CONSTANTS.LLM_RETRY_BASE_DELAY_MS;
        const retryableErrors = AGENT_CONSTANTS.LLM_RETRYABLE_ERRORS;

        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await BedrockService.streamWithCallback(
                    SYSTEM_MODELS.AGENT,
                    messages as any,
                    onDelta,
                    getRecommendedTemperature(SYSTEM_MODELS.AGENT) ?? 0.5,
                    toolConfig,
                    guardrailConfig
                );
                return result as { text: string; content: BedrockContentBlock[]; usage: TokenUsage; stopReason?: string };
            } catch (error: unknown) {
                lastError = error instanceof Error ? error : new Error(String(error));
                const errorName = (error as Record<string, unknown>)?.name as string || '';
                const errorCode = (error as Record<string, unknown>)?.code as string || '';
                const errorMessage = lastError.message;

                const isRetryable = retryableErrors.some(
                    re => errorName.includes(re) || errorCode.includes(re) || errorMessage.includes(re)
                );

                if (!isRetryable || attempt === maxRetries) {
                    LoggerService.error('agent_llm_call_failed', {
                        attempt: attempt + 1,
                        maxRetries,
                        error: errorMessage,
                        retryable: isRetryable,
                        traceId: this.state.traceId
                    }, this.ctx.userId);
                    throw lastError;
                }

                const delay = baseDelay * Math.pow(2, attempt);
                LoggerService.warn('agent_llm_retry', {
                    attempt: attempt + 1,
                    maxRetries,
                    delayMs: delay,
                    error: errorMessage,
                    traceId: this.state.traceId
                }, this.ctx.userId);

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError || new Error('LLM call failed after retries');
    }

    // ── Main Agent Loop ─────────────────────────────────────────────────────

    private async agentLoop(allowedTools: AgentTool[]): Promise<void> {
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

            // Check client disconnect (wired up via AgentEventStore)
            if (this.state.clientDisconnected) {
                LoggerService.info('agent_loop_abort_disconnect', {
                    step: this.state.steps,
                    traceId: this.state.traceId
                }, this.ctx.userId);
                return;
            }

            this.state.steps++;
            this.emit(AGENT_EVENTS.AGENT_STEP, { step: this.state.steps, maxSteps: AGENT_CONSTANTS.MAX_AGENT_STEPS });

            LoggerService.info('agent_step', { step: this.state.steps, traceId: this.state.traceId }, this.ctx.userId);

            const stepStartTime = Date.now();
            let firstTokenTime: number | null = null;
            let currentBlockText = '';
            let hasEmittedBlockStart = false;

            this.state.phase = AgentPhase.GENERATING_RESPONSE;

            // Determine answer mode BEFORE streaming (based on tools used so far)
            this.determineAnswerMode();

            // --- STREAMING CALL WITH RETRY ---
            const { text: fullResponse, content: contentBlocks, usage: stepUsage, stopReason } = await this.streamWithRetry(
                this.state.messages,
                (delta) => {
                    if (!firstTokenTime) firstTokenTime = Date.now();
                    currentBlockText += delta;

                    if (!hasEmittedBlockStart) {
                        this.emit(AGENT_EVENTS.BLOCK_START, { answerMode: this.state.answerMode, step: this.state.steps });
                        hasEmittedBlockStart = true;
                    }

                    this.emit(AGENT_EVENTS.BLOCK_DELTA, { delta });
                },
                toolConfig,
                guardrailConfig
            );

            // If we generated any text, close the block naturally
            if (hasEmittedBlockStart) {
                this.emit(AGENT_EVENTS.BLOCK_END, { step: this.state.steps, content: currentBlockText });
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
                    this.emit.bind(this),
                    this.state.toolResultCache
                );

                usedTools.forEach(t => this.state.usedTools.add(t));

                // Add Assistant Response (Tool Use request)
                this.state.messages.push({
                    role: 'assistant',
                    content: contentBlocks.length > 0 ? contentBlocks : [{ type: 'text', text: fullResponse }]
                });

                // Add Tool Results
                if (toolResults.length > 0) {
                    this.state.messages.push({
                        role: 'user',
                        content: toolResults.map(tr => ({
                            type: 'tool_result' as const,
                            toolUseId: tr.toolUseId,
                            content: tr.content
                        }))
                    });
                }

                // Compress older tool results to save tokens on the next LLM call.
                // Only the latest tool exchange is kept in full — older ones are summarized.
                this.compressOlderToolResults();

            } else {
                // Final Answer — break loop
                this.state.phase = AgentPhase.COMPLETED;
                this.state.finalAnswer = fullResponse;
                this.state.messages.push({ role: 'assistant', content: fullResponse });

                // Re-determine answer mode after all tools have been used
                this.determineAnswerMode();
                break;
            }
        }
    }

    // ── Answer Mode Classification ──────────────────────────────────────────

    /**
     * Compress tool results from older agent steps to save tokens.
     *
     * Strategy:
     *  - The LAST tool_result message (most recent) is kept in full —
     *    the LLM needs it to formulate its answer.
     *  - All OLDER tool_result messages are truncated to a short summary,
     *    since the LLM already processed them in the previous step.
     *  - assistant tool_use messages are kept as-is (they're small — just the call spec).
     *
     * This prevents token explosion in multi-step agent loops where each
     * step re-sends the entire conversation including all previous tool results.
     */
    private compressOlderToolResults(): void {
        const MAX_OLD_RESULT_CHARS = 200;
        const msgs = this.state.messages;

        // Find the index of the LAST tool_result message
        let lastToolResultIdx = -1;
        for (let i = msgs.length - 1; i >= 0; i--) {
            const content = msgs[i].content;
            if (Array.isArray(content) && content.some((b: any) => b.type === 'tool_result')) {
                lastToolResultIdx = i;
                break;
            }
        }

        if (lastToolResultIdx < 0) return;

        // Compress all tool_result messages EXCEPT the last one
        for (let i = 0; i < lastToolResultIdx; i++) {
            const msg = msgs[i];
            if (!Array.isArray(msg.content)) continue;

            const content = msg.content as any[];
            const hasToolResult = content.some((b: any) => b.type === 'tool_result');
            if (!hasToolResult) continue;

            msgs[i] = {
                ...msg,
                content: content.map((block: any) => {
                    if (block.type !== 'tool_result') return block;

                    // Extract text from the result JSON
                    const resultJson = block.content?.[0]?.json?.result
                        || block.content?.[0]?.json
                        || block.content;
                    const resultStr = typeof resultJson === 'string'
                        ? resultJson
                        : JSON.stringify(resultJson);

                    const truncated = resultStr.length > MAX_OLD_RESULT_CHARS
                        ? resultStr.substring(0, MAX_OLD_RESULT_CHARS) + '… (see session context for full details)'
                        : resultStr;

                    return {
                        type: 'tool_result' as const,
                        toolUseId: block.toolUseId,
                        content: [{ json: { result: truncated } }]
                    };
                })
            };
        }

        LoggerService.debug('agent_tool_results_compressed', {
            totalMessages: msgs.length,
            lastToolResultIdx,
            traceId: this.state.traceId
        });
    }

    /**
     * Determines the answer mode based on tools used and attached files.
     * Called ONCE before streaming (not per-token) and once after final answer.
     */
    private determineAnswerMode(): void {
        const usedSearch = this.state.usedTools.has('search');
        const usedPolicy = this.state.usedTools.has('check_policy');

        if (this.state.nativeDocBlocks.length > 0) {
            this.state.answerMode = 'file_grounded';
            this.state.answerState = 'VERIFIED';
        } else if (usedPolicy && usedSearch) {
            this.state.answerMode = 'policy_rag';
            this.state.answerState = 'VERIFIED';
        } else if (usedPolicy) {
            this.state.answerMode = 'policy_grounded';
            this.state.answerState = 'VERIFIED';
        } else if (usedSearch) {
            this.state.answerMode = 'rag';
            this.state.answerState = 'VERIFIED';
        } else {
            this.state.answerMode = 'internal';
            this.state.answerState = 'UNVERIFIED';
        }
    }

    // ── Timeout Handling ────────────────────────────────────────────────────

    private handleTimeout(): void {
        LoggerService.warn('agent_timeout', { steps: this.state.steps, traceId: this.state.traceId }, this.ctx.userId);
        this.state.finalAnswer = AGENT_MESSAGES.ERROR_TIMEOUT;
        this.state.answerMode = 'internal';
        this.state.answerState = 'TIMEOUT';

        this.emit(AGENT_EVENTS.BLOCK_START, { answerMode: 'internal', step: this.state.steps });
        this.emit(AGENT_EVENTS.BLOCK_DELTA, { delta: this.state.finalAnswer });
        this.emit(AGENT_EVENTS.BLOCK_END, { step: this.state.steps, content: this.state.finalAnswer });
        this.emit(AGENT_EVENTS.STATUS, { message: AGENT_MESSAGES.STATUS_TIMEOUT });
    }

    // ── Usage Tracking ──────────────────────────────────────────────────────

    private updateUsage(stepUsage: TokenUsage, durationMs: number): void {
        this.state.totalUsage.input += stepUsage.input;
        this.state.totalUsage.output += stepUsage.output;
        this.state.totalUsage.total += stepUsage.total;

        // Record telemetry metrics
        getMetrics().tokenCounter(SYSTEM_MODELS.AGENT, stepUsage.input, stepUsage.output);
        getMetrics().workflowCounter(this.state.phase, true, durationMs);

        this.emit(AGENT_EVENTS.STEP_USAGE, {
            step: this.state.steps,
            input: stepUsage.input,
            output: stepUsage.output,
            total: stepUsage.total,
            durationMs
        });
    }
}
