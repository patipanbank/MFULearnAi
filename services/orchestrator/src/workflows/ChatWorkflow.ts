import { ChatMessage, CanonicalIR } from '../../../../shared/types';
import { HistoryService } from '../services/HistoryService';
import { KnowledgeService } from '../services/KnowledgeService';
import { PromptService } from '../services/PromptService';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { SummarizationService } from '../services/SummarizationService'; // Added
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

        LoggerService.info('chat_request_received', {
            sessionId,
            messageLength: message?.length || 0,
            modelId,
            fileCount: files?.length || 0
        }, userId);

        // 1. Get Context (Smart Context + History)
        const { messages: history, smartContext } = await HistoryService.getContext(userId, sessionId);

        // 2. RAG Search (Gated by Intent + Heuristic Complexity)
        const userContext = { userId, role: userRole, department: userDepartment };
        const rollingIntent = smartContext?.rolling?.intent;
        let currentIntent = typeof rollingIntent === 'string' ? rollingIntent : (rollingIntent?.primary || 'QUERY');

        // Fast Intent Re-check (Haiku) with Context
        let intentUsage = { input: 0, output: 0, total: 0 };
        if (currentIntent === 'CHITCHAT' || currentIntent === 'QUERY') {
            const intentContext = {
                last_intent: smartContext?.rolling?.intent?.primary || 'QUERY',
                last_decisions: smartContext?.rolling?.decisions || [],
                constraints: smartContext?.rolling?.constraints || []
            };
            const { intent: fastIntent, usage } = await this.quickIntentCheck(message, intentContext);
            intentUsage = usage;
            if (fastIntent !== currentIntent) {
                LoggerService.info('chat_intent_corrected', { old: currentIntent, new: fastIntent, sessionId }, userId);
                currentIntent = fastIntent;
            }
        }

        const RAG_INTENTS = ['FACT_LOOKUP', 'RESEARCH', 'DEBUGGING', 'DESIGN', 'QUERY'];

        // Heuristic RAG Gating: Intent + Complexity Check
        const queryComplexity = message.split(/\s+/).length >= 3 || message.length > 20 || /[\?\.!]/.test(message);
        const hasDomainKeywords = /MFU|system|architecture|security|JWT|canonical|rolling|memory|promotion|auth|Phitsanulok|พิษณุรักษ์|คู่มือ|สิทธิ์|วิจัย|ค้นหา|ระเบียบ|ประกาศ|แนวทาง|ใคร|คือ|ที่ไหน|เมื่อไหร่|อย่างไร|กำหนดการ/i.test(message);

        // Relaxed Rule: Trigger RAG if:
        // 1. Intent is explicitly factual (FACT_LOOKUP, RESEARCH)
        // 2. A specific collection is selected AND (it's complex OR has keywords) AND intent is not social (CHITCHAT)
        // 3. Query matches RAG intents AND (is complex OR has keywords)
        const shouldUseRAG = (currentIntent === 'FACT_LOOKUP' || currentIntent === 'RESEARCH') ||
            (collectionId && currentIntent !== 'CHITCHAT' && (queryComplexity || hasDomainKeywords)) ||
            (RAG_INTENTS.includes(currentIntent) && (queryComplexity || hasDomainKeywords));

        let ragContext = '';
        if (shouldUseRAG) {
            const { text } = await KnowledgeService.search(message, userContext, collectionId, currentIntent);
            ragContext = text;
            LoggerService.info('chat_rag_result', { found: !!ragContext, intent: currentIntent, queryComplexity }, userId);
        }

        const ragSystemPrompt = ragContext ? `\n\nHere is some relevant context from the Knowledge Base:\n<context>\n${ragContext}\n</context>\nUse this context to answer the user's question if relevant.` : '';

        // 2.5 Smart Context Injection
        let summaryContext = '';
        if (smartContext) {
            summaryContext = `
\n\n=== SMART CONTEXT ===
<canonical_memory>
${smartContext.canonical || 'No established history.'}
</canonical_memory>

<rolling_context>
${JSON.stringify(smartContext.rolling || {}, null, 2)}
</rolling_context>
=====================
`;
        } else if (history.length === 0) {
            // Fallback or Cold Start
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
                { totalTokens: tokenUsage.total + intentUsage.total },
                envType,
                modelId
            );

            LoggerService.info('chat_completion', { sessionId, tokens: tokenUsage }, userId);

            // 5. Background Summarization (Fire-and-forget)
            SummarizationService.runUpdate(userId, sessionId, [currentMessage, assistantMessage], smartContext)
                .catch((e: any) => LoggerService.error('Background Summary Failed', e));
        });
    }

    private static async quickIntentCheck(query: string, context?: any): Promise<{ intent: string, usage: { input: number, output: number, total: number } }> {
        try {
            const contextStr = context ? `
Context:
- Last Intent: ${context.last_intent}
- Decisions: ${context.last_decisions?.join(', ')}
- Constraints: ${context.constraints?.join(', ')}
` : '';

            const prompt = `Classify user intent for: "${query}"
            Options: FACT_LOOKUP, RESEARCH, DEBUGGING, DESIGN, CHITCHAT, QUERY.
            ${contextStr}
            Note: If query is ambiguous (e.g. "Why is it broken?"), rely on Last Intent.
            Output ONLY the enum value in <intent></intent> tags.`;

            const { text: response, usage } = await BedrockService.sendChat('anthropic.claude-3-5-sonnet-20240620-v1:0', [{ role: 'user', content: prompt }], '', 0.1);
            const match = response.match(/<intent>(.*?)<\/intent>/);
            return { intent: match ? match[1].trim() : 'QUERY', usage };
        } catch {
            return { intent: 'QUERY', usage: { input: 0, output: 0, total: 0 } };
        }
    }
}
