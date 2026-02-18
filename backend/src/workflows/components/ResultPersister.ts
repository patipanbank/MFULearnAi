import { HistoryService } from '../../services/HistoryService';
import { SummarizationService } from '../../services/SummarizationService';
import { LoggerService } from '../../services/LoggerService';
import { AGENT_EVENTS, AgentContext, WorkflowState } from '../types/AgentTypes';
import { MODELS } from '../../config/models';

export class ResultPersister {
    static async finalize(
        ctx: AgentContext,
        state: WorkflowState,
        emit: (type: string, payload: any) => void,
        store: any // AgentEventStore
    ) {
        if (!state.finalAnswer) return;

        const { finalAnswer, answerMode, answerState, steps, totalUsage, startTime, history } = state;
        const totalDurationMs = Date.now() - startTime;

        let confidence = 'Low';
        let explanation = { basis: 'Internal', assumptions: [], missing_info: [] };

        if (answerMode === 'file_grounded' || answerMode === 'rag') {
            confidence = 'High';
            explanation.basis = 'RAG'; // simplified for now
        }

        emit(AGENT_EVENTS.METADATA, {
            metadata: {
                answer_mode: answerMode,
                answer_state: answerState,
                usedRAG: answerMode !== 'internal',
                stepsUsed: steps,
                totalTokens: totalUsage.total,
                explanation
            }
        });

        emit(AGENT_EVENTS.AGENT_COMPLETE, {
            totalSteps: steps,
            totalTokens: totalUsage.total,
            durationMs: totalDurationMs,
            toolsUsed: Array.from(state.usedTools),
            answerMode
        });

        emit(AGENT_EVENTS.STATUS, { message: '' });

        // -- Persistence --
        // Wait for file uploads
        const uploadedAttachments: any[] = [];
        if (state.uploadPromises.length > 0) {
            const results = await Promise.all(state.uploadPromises);
            results.forEach(r => r && uploadedAttachments.push(r));
        }

        const userMsgToSave: any = { role: 'user' as const, content: ctx.message, timestamp: new Date() };
        if (uploadedAttachments.length > 0) {
            // Filter out images from attachments to avoid visual duplication in frontend
            // (Since we are populating 'images' with Base64 for reliable display)
            userMsgToSave.attachments = uploadedAttachments.filter((a: any) => !a.mimeType.startsWith('image/'));
        }

        // Populate 'images' with Base64 from context for immediate/reliable display
        // MOVED OUTSIDE of uploadedAttachments check to ensure it runs even if no files were uploaded
        if (ctx.images && ctx.images.length > 0) {
            userMsgToSave.images = ctx.images.map((img: any) => ({
                mediaType: img.format ? `image/${img.format}` : 'image/png',
                data: img.source?.bytes ? Buffer.from(img.source.bytes).toString('base64') : ''
            }));
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
            agentEvents: store.getEventLog().map((e: any) => ({
                ...e, timestamp: new Date(e.timestamp)
            }))
        };

        const { userId, sessionId } = ctx;
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
            tokens: totalUsage, model: MODELS.PRIMARY, steps, sessionId, traceId: state.traceId
        }, userId);

        // Background Summary & Title
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
    }
}
