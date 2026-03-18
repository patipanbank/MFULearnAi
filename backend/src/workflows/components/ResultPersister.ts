import { HistoryService } from '../../services/HistoryService';
import { SummarizationService } from '../../services/SummarizationService';
import { LoggerService } from '../../services/LoggerService';
import { AGENT_EVENTS, AgentContext, WorkflowState } from '../types/AgentTypes';
import { MODELS, computeWeightedTokens } from '../../config/models';
import { AgentEventStore } from '../../services/AgentEventStore';
import { redis } from '../../config/redis';
import { PromptExperimentService } from '../../services/PromptExperimentService';
import { UserMemoryService } from '../../services/UserMemoryService';

// ── Saga Constants ──────────────────────────────────────────
const SAGA_MAX_RETRIES = 3;
const SAGA_RETRY_DELAY_MS = 500;
const SAGA_RECOVERY_KEY_PREFIX = 'saga:pending:';
const SAGA_RECOVERY_TTL = 3600; // 1 hour

/** Saga step status for compensation tracking */
interface SagaStep {
    name: string;
    status: 'pending' | 'completed' | 'failed' | 'compensated';
    data?: any;
    error?: string;
}

export class ResultPersister {
    static async finalize(
        ctx: AgentContext,
        state: WorkflowState,
        emit: (type: string, payload: Record<string, unknown>) => void,
        store: AgentEventStore
    ): Promise<void> {
        if (!state.finalAnswer) return;

        const { finalAnswer, answerMode, answerState, steps, totalUsage, startTime, history } = state;
        const totalDurationMs = Date.now() - startTime;
        const weightedTokens = computeWeightedTokens(totalUsage.total, ctx.modelId || MODELS.PRIMARY);

        let confidence = 'Low';
        let explanation = { basis: 'Internal', assumptions: [], missing_info: [] };

        if (answerMode === 'file_grounded' || answerMode === 'rag' || answerMode === 'policy_grounded' || answerMode === 'policy_rag') {
            confidence = 'High';
            explanation.basis = answerMode === 'policy_grounded' ? 'Policy KB'
                : answerMode === 'policy_rag' ? 'Policy KB + RAG'
                : answerMode === 'file_grounded' ? 'Attached File'
                : 'RAG';
        }

        emit(AGENT_EVENTS.METADATA, {
            metadata: {
                answer_mode: answerMode,
                answer_state: answerState,
                usedRAG: answerMode !== 'internal',
                stepsUsed: steps,
                totalTokens: totalUsage.total,
                weightedTokens,
                explanation
            }
        });

        emit(AGENT_EVENTS.AGENT_COMPLETE, {
            totalSteps: steps,
            totalTokens: totalUsage.total,
            weightedTokens,
            durationMs: totalDurationMs,
            toolsUsed: Array.from(state.usedTools),
            answerMode
        });

        emit(AGENT_EVENTS.STATUS, { message: '' });

        // -- Persistence with Saga/Compensation Pattern --
        const uploadedAttachments: any[] = [];
        if (state.uploadPromises.length > 0) {
            const results = await Promise.all(state.uploadPromises);
            results.forEach(r => r && uploadedAttachments.push(r));
        }

        const userMsgToSave: any = { role: 'user' as const, content: ctx.message, timestamp: new Date() };
        if (uploadedAttachments.length > 0) {
            userMsgToSave.attachments = uploadedAttachments;
        }

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
            agentEvents: store.getEventLog().reduce((acc: any[], e: any) => {
                if (e.type === 'block_start') return acc;
                if (e.type === 'block_end') {
                    acc.push({
                        ...e,
                        type: 'block',
                        timestamp: new Date(e.timestamp)
                    });
                } else {
                    acc.push({ ...e, timestamp: new Date(e.timestamp) });
                }
                return acc;
            }, [])
        };

        const { userId, sessionId } = ctx;

        // ── Saga Execution with Compensation ────────────────
        await this.executeSaga(userId, sessionId, state, ctx, {
            userMsgToSave,
            assistantMsgToSave,
            totalUsage,
            weightedTokens,
            traceId: state.traceId,
        }, emit);

        // Background Summary & Title (fire-and-forget, no saga needed)
        SummarizationService.runUpdate(userId, sessionId, [userMsgToSave, assistantMsgToSave], state.smartContext || {
            canonical: '',
            rolling: {
                facts: [],
                intent: { primary: 'QUERY', secondary: [], confidence: 1.0 },
                constraints: [],
                decisions: [],
                open_questions: [],
                confidence_score: 1.0
            },
            version: 0,
            hashes: { canonical: '', rolling: '', raw: '' },
            lastCanonizedAt: new Date()
        }).catch((e: any) => LoggerService.error('Background Summary Failed', e));

        if (history.length === 0) {
            SummarizationService.updateTitle(userId, sessionId, ctx.message)
                .then(title => title && emit(AGENT_EVENTS.TITLE, { title }))
                .catch(e => LoggerService.error('Title Gen Failed', e));
        }

        // ── Background: Cross-Session User Memory Extraction ──
        UserMemoryService.extractAndStore(
            userId, sessionId, ctx.message, finalAnswer
        ).catch((e: any) => LoggerService.debug('user_memory_extraction_bg_failed', { error: e.message }));

        // ── Background: Prompt A/B Experiment Metrics ──
        const experimentContext = (state as any)._experimentContext;
        if (experimentContext) {
            PromptExperimentService.recordOutcome(
                experimentContext.experimentId,
                experimentContext.variantId,
                {
                    responseTokens: totalUsage.total,
                    latencyMs: totalDurationMs,
                    isError: state.answerState === 'ERROR',
                    toolsUsed: Array.from(state.usedTools),
                    answerMode: answerMode
                }
            ).catch((e: any) => LoggerService.debug('experiment_record_bg_failed', { error: e.message }));
        }

        // ── Background: Prompt Analytics (always, independent of A/B) ──
        PromptExperimentService.recordPromptAnalytics(
            'active', // Prompt ID — resolved at recording time
            1,        // Version
            (process.env.APP_ENV === 'production' ? 'PROD' : 'TEST') as 'TEST' | 'PROD',
            {
                inputTokens: totalUsage.input,
                outputTokens: totalUsage.output,
                latencyMs: totalDurationMs,
                steps,
                answerMode,
                toolsUsed: Array.from(state.usedTools),
                isError: state.answerState === 'ERROR'
            }
        ).catch((e: any) => LoggerService.debug('prompt_analytics_bg_failed', { error: e.message }));
    }

    // ── Saga Orchestrator ───────────────────────────────────

    /**
     * Executes the persistence saga with ordered steps and compensation.
     *
     * Steps:
     *  1. Save to Redis recovery log (WAL)
     *  2. Add user message to Redis history
     *  3. Add assistant message to Redis history
     *  4. Persist to MongoDB (cold storage)
     *  5. Clear Redis recovery log
     *
     * On failure: compensate completed steps in reverse order.
     */
    private static async executeSaga(
        userId: string,
        sessionId: string,
        state: WorkflowState,
        ctx: AgentContext,
        payload: {
            userMsgToSave: any;
            assistantMsgToSave: any;
            totalUsage: { input: number; output: number; total: number };
            weightedTokens: number;
            traceId: string;
        },
        emit: (type: string, payload: Record<string, unknown>) => void
    ): Promise<void> {
        const sagaSteps: SagaStep[] = [];
        const recoveryKey = `${SAGA_RECOVERY_KEY_PREFIX}${state.traceId}`;

        try {
            // Step 0: Write-Ahead Log — persist intent to Redis before any mutation
            await this.withRetry(async () => {
                await redis.setex(recoveryKey, SAGA_RECOVERY_TTL, JSON.stringify({
                    userId, sessionId,
                    traceId: state.traceId,
                    userMsg: payload.userMsgToSave,
                    assistantMsg: payload.assistantMsgToSave,
                    usage: payload.totalUsage,
                    weightedTokens: payload.weightedTokens,
                    createdAt: new Date().toISOString()
                }));
            }, 'saga_wal_write');
            sagaSteps.push({ name: 'wal_write', status: 'completed' });

            // Step 1: Add user message to Redis (hot storage)
            await this.withRetry(async () => {
                await HistoryService.addMessage(userId, sessionId, payload.userMsgToSave);
            }, 'saga_add_user_msg');
            sagaSteps.push({ name: 'redis_user_msg', status: 'completed' });

            // Step 2: Add assistant message to Redis (hot storage)
            await this.withRetry(async () => {
                await HistoryService.addMessage(userId, sessionId, payload.assistantMsgToSave);
            }, 'saga_add_assistant_msg');
            sagaSteps.push({ name: 'redis_assistant_msg', status: 'completed' });

            // Step 3: Persist to MongoDB (cold storage)
            await this.withRetry(async () => {
                await HistoryService.saveToPersistentStorage(
                    userId, sessionId,
                    [payload.userMsgToSave, payload.assistantMsgToSave],
                    { totalTokens: payload.totalUsage.total, weightedTokens: payload.weightedTokens },
                    process.env.ENV_TYPE || 'TEST',
                    ctx.modelId || MODELS.PRIMARY
                );
            }, 'saga_persist_mongodb');
            sagaSteps.push({ name: 'mongodb_persist', status: 'completed' });

            // Step 4: Clear WAL — saga is complete
            await redis.del(recoveryKey).catch(() => { /* Best effort */ });

            LoggerService.info('chat_completion', {
                tokens: payload.totalUsage,
                weightedTokens: payload.weightedTokens,
                model: ctx.modelId || MODELS.PRIMARY,
                steps: state.steps,
                sessionId,
                traceId: state.traceId,
                sagaSteps: sagaSteps.length
            }, userId);

        } catch (err: any) {
            // Saga failed — run compensation in reverse order
            LoggerService.error('saga_failed', {
                sessionId,
                traceId: state.traceId,
                error: err.message,
                completedSteps: sagaSteps.filter(s => s.status === 'completed').map(s => s.name),
                failedAt: sagaSteps.length
            }, userId);

            await this.compensate(userId, sessionId, sagaSteps, recoveryKey);

            // Emit a non-fatal warning — the LLM response was already streamed to the user
            LoggerService.warn('saga_compensated', {
                sessionId,
                traceId: state.traceId,
                compensatedSteps: sagaSteps.filter(s => s.status === 'compensated').map(s => s.name),
                walPreserved: true
            }, userId);
        }
    }

    // ── Compensation Logic ──────────────────────────────────

    /**
     * Compensate completed saga steps in reverse order.
     * WAL is intentionally NOT deleted — it serves as a recovery record.
     */
    private static async compensate(
        userId: string,
        sessionId: string,
        steps: SagaStep[],
        recoveryKey: string
    ): Promise<void> {
        // Walk backward through completed steps
        for (let i = steps.length - 1; i >= 0; i--) {
            const step = steps[i];
            if (step.status !== 'completed') continue;

            try {
                switch (step.name) {
                    case 'mongodb_persist':
                        // MongoDB compensation: mark as incomplete via a flag
                        // (Full rollback would require transactional MongoDB — we log instead)
                        LoggerService.warn('saga_compensate_mongodb', {
                            userId, sessionId,
                            action: 'flagged_incomplete'
                        }, userId);
                        step.status = 'compensated';
                        break;

                    case 'redis_assistant_msg':
                    case 'redis_user_msg':
                        // Redis compensation: messages are in the hot cache.
                        // We do NOT remove them — they'll expire naturally via LRU/TTL.
                        // Removing could cause worse UX (user sees blank history).
                        LoggerService.info('saga_compensate_redis_skip', {
                            step: step.name,
                            reason: 'messages_preserved_for_ux'
                        }, userId);
                        step.status = 'compensated';
                        break;

                    case 'wal_write':
                        // WAL is preserved for recovery — do not delete
                        LoggerService.info('saga_wal_preserved', {
                            recoveryKey,
                            reason: 'available_for_manual_recovery'
                        }, userId);
                        step.status = 'compensated';
                        break;
                }
            } catch (compErr: any) {
                LoggerService.error('saga_compensation_error', {
                    step: step.name,
                    error: compErr.message
                }, userId);
            }
        }
    }

    // ── Retry Helper ────────────────────────────────────────

    /**
     * Retry an async operation with exponential backoff.
     * Throws the last error after all retries are exhausted.
     */
    private static async withRetry(
        fn: () => Promise<void>,
        label: string,
        maxRetries: number = SAGA_MAX_RETRIES
    ): Promise<void> {
        let lastError: Error | undefined;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                await fn();
                return;
            } catch (err: any) {
                lastError = err;
                if (attempt < maxRetries) {
                    const delay = SAGA_RETRY_DELAY_MS * Math.pow(2, attempt);
                    LoggerService.warn('saga_step_retry', {
                        label,
                        attempt: attempt + 1,
                        maxRetries,
                        delayMs: delay,
                        error: err.message
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw lastError;
    }

    // ── Recovery: Process pending WAL entries ───────────────

    /**
     * Scan Redis for pending saga WAL entries and attempt to replay them.
     * Call this on application startup to recover from crashed workflows.
     */
    static async recoverPendingSagas(): Promise<{ recovered: number; failed: number }> {
        let recovered = 0;
        let failed = 0;

        try {
            const keys = await redis.keys(`${SAGA_RECOVERY_KEY_PREFIX}*`);
            if (keys.length === 0) return { recovered, failed };

            LoggerService.info('saga_recovery_start', { pendingCount: keys.length });

            for (const key of keys) {
                try {
                    const raw = await redis.get(key);
                    if (!raw) continue;

                    const data = JSON.parse(raw);
                    const { userId, sessionId, userMsg, assistantMsg, usage, weightedTokens } = data;

                    // Attempt to persist to MongoDB
                    await HistoryService.saveToPersistentStorage(
                        userId, sessionId,
                        [userMsg, assistantMsg],
                        { totalTokens: usage.total, weightedTokens },
                        process.env.ENV_TYPE || 'TEST',
                        ''
                    );

                    // Success — clear WAL entry
                    await redis.del(key);
                    recovered++;

                    LoggerService.info('saga_recovery_success', {
                        traceId: data.traceId,
                        userId, sessionId
                    });
                } catch (err: any) {
                    failed++;
                    LoggerService.error('saga_recovery_failed', {
                        key,
                        error: err.message
                    });
                }
            }

            LoggerService.info('saga_recovery_complete', { recovered, failed });
        } catch (err: any) {
            LoggerService.error('saga_recovery_scan_error', { error: err.message });
        }

        return { recovered, failed };
    }
}
