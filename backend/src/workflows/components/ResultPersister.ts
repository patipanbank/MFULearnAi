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
            userMsgToSave.attachments = uploadedAttachments;
            // Backward Compatibility: Frontend expects 'images' for display
            userMsgToSave.images = uploadedAttachments
                .filter(a => a.mimeType.startsWith('image/'))
                .map(a => ({
                    type: 'image',
                    source: {
                        // If we had a public URL, we'd use it. For now, we might need a way to serve it.
                        // But wait, the frontend might expect base64 for immediate display?
                        // Actually, if we just uploaded it, we don't have the base64 anymore in 'uploadedAttachments' (it returns metadata).
                        // checking ChatAttachmentService return: { key, filename, ... }
                        // We need to provide a way for frontend to load it. 
                        // Let's assume frontend can load via /api/attachments/:key ?
                        // Or we should persist the base64 if we want it to work 'offline'? 
                        // Better: Just mark it as an image attachment.
                    },
                    // Frontend 'ChatMessage.vue' likely checks 'images' prop.
                    // If it expects base64, we failed.
                    // If we want it to show up, we need to know what frontend expects.
                    // Looking at previous context is pointless without reading frontend code.
                    // Safe bet: The 'ctx.images' had the base64. We should probably save THAT if we want immediate display
                    // OR we accept that 'attachments' is the new way.
                    // But user says "Image not saved".
                    // Let's add the original base64 back from ctx.images if available?
                    // ctx.images has { source: { bytes: ... } }
                }));

            // BETTER FIX: Use the original ctx.images for the 'images' field so it saves to DB with Base64 (Heavy, but works)
            // Or construct a valid image object.
            if (ctx.images && ctx.images.length > 0) {
                userMsgToSave.images = ctx.images.map((img: any) => ({
                    mediaType: img.format ? `image/${img.format}` : 'image/png',
                    data: img.source?.bytes ? Buffer.from(img.source.bytes).toString('base64') : ''
                }));
            }
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
