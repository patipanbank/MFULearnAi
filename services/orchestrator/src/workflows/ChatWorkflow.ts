import { ChatMessage, CanonicalIR } from '../../../../shared/types';
import { HistoryService } from '../services/HistoryService';
import { KnowledgeService } from '../services/KnowledgeService';
import { PromptService } from '../services/PromptService';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { Response } from 'express';

interface ChatRequest {
    userId: string;
    sessionId: string;
    message: string;
    modelId: string;
    collectionId?: string;
    context?: string;
    scenarioId?: string;
    images?: any[];
    files?: any[];
    userRole: string;
    userDepartment?: string;
}

export class ChatWorkflow {
    static async execute(req: ChatRequest, res: Response, fileParses: CanonicalIR[] = []) {
        const { userId, sessionId, message, modelId, collectionId, context, scenarioId, images, files, userRole, userDepartment } = req;
        const envType = (process.env.ENV_TYPE || 'TEST') as 'TEST' | 'PROD';

        console.log(`[ChatWorkflow] Executing. Context ID: ${require('../services/ContextService').ContextService.getCorrelationId()}`);

        LoggerService.log('info', 'chat_request_received', {
            sessionId,
            messageLength: message?.length || 0,
            modelId,
            fileCount: files?.length || 0
        }, userId);

        // 1. Get Context (Summary + History)
        const { messages: history, summary } = await HistoryService.getContext(userId, sessionId);

        // 2. RAG Context (Optional)
        const userContext = { userId, role: userRole, department: userDepartment };
        const ragContext = await KnowledgeService.search(message || '', userContext, collectionId);
        const ragSystemPrompt = ragContext ? `\n\nHere is some relevant context from the Knowledge Base:\n<context>\n${ragContext}\n</context>\nUse this context to answer the user's question if relevant.` : '';

        // 2.5 Smart Context Injection
        let summaryContext = '';
        if (summary) {
            summaryContext = `\n\n<previous_conversation_summary>\n${summary}\n</previous_conversation_summary>\n(Use this summary to understand previous context, but prioritize the raw messages below)`;
        }

        // 3. Prepare System Prompt
        const corePrompt = await PromptService.getCoreSystemPrompt(envType);
        let scenarioPrompt = '';
        if (scenarioId) {
            const sp = await PromptService.getScenarioPrompt(scenarioId, userId);
            if (sp) scenarioPrompt = `\n\n=== ACT AS FOLLOWS ===\n${sp}`;
        }
        const additionalContext = context ? `\n\n${PromptService.getContextPrompt(context)}` : '';

        // IR Context Builder
        let fileContextPrompt = '';
        if (fileParses.length > 0) {
            fileContextPrompt += `\n\n=== ATTACHED FILE CONTEXT ===\n`;

            fileParses.forEach((ir, idx) => {
                const originalName = files && files[idx] ? files[idx].name : `File ${idx + 1}`;
                fileContextPrompt += `\n[File: ${originalName}]\n`;

                if (ir.metadata?.warnings?.length) {
                    const warningMsg = ir.metadata.warnings.map(w => w.message).join('; ');
                    fileContextPrompt += `[WARNING: ${warningMsg}]\n`;
                }

                if (ir.metadata?.layout === 'multi-column') {
                    fileContextPrompt += `[Hint: Multi-column layout detected. Read blocks accordingly.]\n`;
                }

                // Heuristic truncating (duplicate logic from server.ts)
                let charCount = 0;
                const MAX_CHARS = 50000;

                for (const block of ir.blocks) {
                    if (charCount > MAX_CHARS) {
                        fileContextPrompt += `\n... [Remaining content truncated due to length] ... \n`;
                        break;
                    }
                    let blockText = `\n`;
                    if (block.metadata.page) blockText += `[Page ${block.metadata.page}] `;
                    if (block.metadata.sheet) blockText += `[Sheet: ${block.metadata.sheet}] `;
                    if (block.metadata.title) blockText += `[Section: ${block.metadata.title}] `;

                    blockText += `\n${block.content}`;

                    if (block.metadata.confidence && block.metadata.confidence < 0.6) {
                        blockText += ` [Low Confidence]`;
                    }

                    fileContextPrompt += blockText;
                    charCount += blockText.length;
                }
            });
            fileContextPrompt += `\n\n=== END ATTACHED FILES ===\nIf information is missing or unclear from the files, state that explicitly.`;
        }

        const finalSystemContent = corePrompt + additionalContext + summaryContext + ragSystemPrompt + fileContextPrompt + scenarioPrompt;
        const systemMessage: ChatMessage = { role: 'system', content: finalSystemContent, timestamp: new Date() };

        const currentMessage: ChatMessage = {
            role: 'user',
            content: message || '',
            images: images || [],
            files: files || [],
            timestamp: new Date()
        };

        const formatMessageForAI = (msg: ChatMessage) => ({
            role: msg.role,
            content: msg.content,
            images: msg.images
        });

        const messagesToSend = [
            systemMessage,
            ...history.map(formatMessageForAI),
            formatMessageForAI(currentMessage)
        ];

        // 4. Stream Response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

        await BedrockService.streamChat(messagesToSend, modelId, res, async (fullText, tokenUsage) => {
            // On Complete
            const assistantMessage: ChatMessage = { role: 'assistant', content: fullText, timestamp: new Date() };

            await HistoryService.addMessage(userId, sessionId, currentMessage);
            await HistoryService.addMessage(userId, sessionId, assistantMessage);
            await HistoryService.trimHistory(userId, sessionId);

            await HistoryService.saveToPersistentStorage(
                userId,
                sessionId,
                [currentMessage, assistantMessage],
                { totalTokens: tokenUsage.total },
                envType,
                modelId
            );

            LoggerService.log('info', 'chat_completion', { sessionId, tokens: tokenUsage }, userId);

            // 5. Background Summarization (Fire-and-forget)
            // Trigger every 5 turns (metadata.messageCount % 10 === 0)?
            // Or if history length > 10?
            if (history.length > 5) { // Simple trigger
                const correlationId = require('../services/ContextService').ContextService.getCorrelationId(); // Capture current ID

                import('../services/SummarizationService').then(async ({ SummarizationService }) => {
                    // Restore context for background task
                    require('../services/ContextService').ContextService.run({ correlationId }, async () => {
                        const newSummary = await SummarizationService.summarize([...history, currentMessage, assistantMessage], summary);
                        if (newSummary && newSummary !== summary) {
                            await HistoryService.updateSummary(userId, sessionId, newSummary);
                            LoggerService.log('info', 'summary_updated', { sessionId }, userId);
                        }
                    });
                }).catch(err => console.error(err));
            }
        });
    }
}
