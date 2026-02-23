import { BedrockService } from './BedrockService';
import { HistoryService } from './HistoryService';
import { LoggerService } from './LoggerService';
import { Conversation } from '../models/Conversation';
import crypto from 'crypto';
import { SYSTEM_MODELS, MODELS, computeWeightedTokens } from '../config/models';
import { ChatMessage, SmartContext, RollingContext } from '../../../shared/types';

/** Typed correction payloads for manual context corrections */
type FactCorrection = string | { text: string };
interface IntentCorrection {
    primary: string;
    secondary?: string[];
}

export class SummarizationService {
    private static CANONIZATION_INTERVAL = 5;

    private static ROLLING_PROMPT = `
You are a Memory Manager AI. Your goal is to update the "Rolling Context" based on the latest conversation.
Output STRICTLY in JSON within <json> sentinel tags.
DO NOT include any conversational text, pleasantries, or markdown formatting outside the sentinel tags.

Input:
- Current Rolling Context (JSON)
- New Messages

Task:
1. Update 'facts' with new critical information (keep concise).
2. Update 'tentative_facts' for items that seem uncertain.
3. Update 'intent' with primary/secondary goals and confidence.
4. Update 'constraints'.
5. Update 'decisions'.
6. Update 'open_questions'.

Output Format:
<json>
{
  "facts": ["string"],
  "tentative_facts": ["string"],
  "intent": {
    "primary": "string",
    "secondary": ["string"],
    "confidence": 0.0 to 1.0
  },
  "constraints": ["string"],
  "decisions": ["string"],
  "open_questions": ["string"],
  "confidence_score": 0.0 to 1.0
}
</json>
`;

    private static CANONIZATION_PROMPT = `
You are a Historian AI. Your goal is to merge the temporary "Rolling Context" into the permanent "Canonical Memory".
Canonical Memory is a concise, timeline-based summary of the entire project/conversation.

Input:
- Current Canonical Memory (Text)
- Rolling Context (JSON)

Task:
1. Append validated facts and decisions from Rolling Context into the Canonical layout.
2. Keep it concise but lossless for technical details.
3. DO NOT include temporary chit-chat.
4. Output ONLY the updated memory text. Do not overlook the output format.

Output: Updated Canonical Memory (Text only).
`;

    static async runUpdate(
        userId: string,
        sessionId: string,
        newMessages: ChatMessage[],
        currentContext: SmartContext
    ) {
        try {
            // 1. Generate New Rolling Summary
            let newRolling = await this.generateRollingSummary(currentContext.rolling, newMessages, userId);

            // 1.1 TENTATIVE PROMOTION (Semantic Normalization)
            newRolling = this.applyTentativePromotion(currentContext.rolling, newRolling);

            // 1.2 HEURISTIC REFINEMENT
            this.applyHeuristicRefinement(currentContext.rolling, newRolling, sessionId, newMessages.length);

            // 2. Check Canonization Trigger
            let newCanonical = currentContext.canonical;
            const targetVersion = currentContext.version + 1;

            const rollingHash = this.calculateRollingHash(newRolling);
            const isDuplicate = currentContext.hashes.rolling === rollingHash;

            // 2.2 Intent Volatility Check (Memory Poisoning Guard)
            const volatility = this.checkVolatility(currentContext, newRolling.intent.primary);

            if (volatility.blocked) {
                LoggerService.warn('intent_poisoning_detected', { sessionId, score: volatility.score });
                newRolling.confidence_score = Math.min(newRolling.confidence_score, 0.4); // Force downgrade
            }

            const shouldCanonize = this.shouldCanonize(targetVersion, newRolling.confidence_score, isDuplicate, volatility.blocked);

            if (shouldCanonize) {
                newCanonical = await this.canonize(currentContext.canonical, newRolling, userId);
                LoggerService.info(`[SmartContext] Canonization successful for ${sessionId}`);
            } else if (targetVersion % this.CANONIZATION_INTERVAL === 0) {
                // Log skip reason at canonization intervals for observability
                const reason = isDuplicate ? 'Idempotent' : volatility.blocked ? 'Volatile' : `Low confidence (${newRolling.confidence_score})`;
                LoggerService.warn(`[SmartContext] Canonization skipped for ${sessionId}: ${reason}`);
            }

            // Guard: Canonical Length (Soft Warning + Rate limit)
            if (newCanonical.length > 5000 && targetVersion % 10 === 0) {
                LoggerService.warn(`[SmartContext] Canonical memory for ${sessionId} is getting large (${newCanonical.length} chars). Consider auto-summarization.`);
                // TODO: Trigger actual auto-summarization logic here in the future
            }

            // 3. Generate Hashes for Integrity Tracking
            const nextContext = this.buildNextContext(
                currentContext,
                newCanonical,
                newRolling,
                targetVersion,
                rollingHash,
                JSON.stringify(newMessages),
                shouldCanonize,
                isDuplicate,
                volatility
            );

            await HistoryService.updateSmartContext(userId, sessionId, nextContext);
            LoggerService.info(`[SmartContext] Version ${nextContext.version} saved. State Hash: ${rollingHash.substring(0, 8)}`);

        } catch (e) {
            LoggerService.error('Summarization Pipeline Failed', e instanceof Error ? { message: e.message, stack: e.stack } : e);
        }
    }

    private static applyTentativePromotion(current: RollingContext, updated: RollingContext): RollingContext {
        // Safer normalization for Thai: only trim, lowercase, and remove excessive whitespace, keep original characters intact. 
        // Hash it to ensure safe map keys.
        const normalize = (s: string) => crypto.createHash('sha256').update(s.trim().toLowerCase().replace(/\s+/g, ' ')).digest('hex');
        const previousTentativeMap = new Map((current.tentative_facts || []).map(f => [normalize(f), f]));

        const promotedFacts: string[] = [];
        const remainingTentative: string[] = [];

        if (updated.tentative_facts) {
            for (const fact of updated.tentative_facts) {
                const norm = normalize(fact);
                if (previousTentativeMap.has(norm)) {
                    promotedFacts.push(fact); // Promoted!
                } else {
                    remainingTentative.push(fact);
                }
            }
        }

        updated.facts = [...(updated.facts || []), ...promotedFacts];
        updated.tentative_facts = remainingTentative;
        return updated;
    }

    private static applyHeuristicRefinement(current: RollingContext, updated: RollingContext, sessionId: string, newMsgCount: number) {
        const currentTotal = (current.facts?.length || 0) +
            (current.tentative_facts?.length || 0) +
            (current.decisions?.length || 0);
        const newTotal = (updated.facts?.length || 0) +
            (updated.tentative_facts?.length || 0) +
            (updated.decisions?.length || 0);

        const factDelta = Math.abs(newTotal - currentTotal);

        if (newMsgCount > 2 && factDelta === 0 && updated.confidence_score > 0.8) {
            updated.confidence_score *= 0.8;
            LoggerService.info(`[SmartContext] Damping confidence due to zero state change in ${sessionId}`);
        }
    }

    private static calculateRollingHash(rolling: RollingContext): string {
        const coreState = {
            f: rolling.facts,
            d: rolling.decisions,
            c: rolling.constraints
        };
        return crypto.createHash('sha256').update(JSON.stringify(coreState)).digest('hex');
    }

    private static checkVolatility(currentContext: SmartContext, newPrimaryIntent: string): { score: number, blocked: boolean, history: string[] } {
        const intentHistory = [...(currentContext.metadata?.intent_history || [])];
        intentHistory.push(newPrimaryIntent);
        if (intentHistory.length > 5) intentHistory.shift(); // Keep last 5

        const last3 = intentHistory.slice(-3);
        const uniqueIntents = new Set(last3).size;

        // Exponentially weighted moving average (EWMA) with proper scaling.
        // uniqueIntents >= 3 means every recent message changed intent → high volatility signal.
        // Use a stronger weight for the new signal so it can actually breach the 0.5 threshold.
        const previousVolatility = currentContext.metadata?.volatility_score || 0;
        const newSignal = uniqueIntents >= 3 ? 1.0 : (uniqueIntents >= 2 ? 0.4 : 0.0);
        const score = previousVolatility * 0.5 + newSignal * 0.5;

        return {
            score,
            blocked: score > 0.5,
            history: intentHistory
        };
    }

    private static shouldCanonize(targetVersion: number, confidence: number, isDuplicate: boolean, isVolatileBlocked: boolean): boolean {
        if (isVolatileBlocked) return false;
        if (isDuplicate) return false;
        return targetVersion % this.CANONIZATION_INTERVAL === 0 && confidence >= 0.7;
    }

    private static buildNextContext(
        currentContext: SmartContext,
        newCanonical: string,
        newRolling: RollingContext,
        targetVersion: number,
        rollingHash: string,
        rawStringifier: string,
        shouldCanonize: boolean,
        isDuplicate: boolean,
        volatility: { score: number, blocked: boolean, history: string[] }
    ): SmartContext {
        return {
            canonical: newCanonical,
            rolling: newRolling,
            version: targetVersion,
            hashes: {
                canonical: shouldCanonize && !isDuplicate ? crypto.createHash('sha256').update(newCanonical).digest('hex') : currentContext.hashes.canonical,
                rolling: rollingHash,
                raw: crypto.createHash('sha256').update(rawStringifier).digest('hex')
            },
            lastCanonizedAt: (shouldCanonize && !isDuplicate) ? new Date() : currentContext.lastCanonizedAt,
            metadata: {
                intent_history: volatility.history,
                volatility_score: volatility.score
            }
        };
    }

    static async handleManualCorrection(
        userId: string,
        sessionId: string,
        type: 'fact' | 'intent',
        correction: FactCorrection | IntentCorrection
    ) {
        try {
            // Use MongoDB atomic updates to prevent race conditions during concurrent corrections
            if (type === 'fact') {
                const factCorrection = correction as FactCorrection;
                const newFact = typeof factCorrection === 'string' ? factCorrection : factCorrection.text;
                const formattedFact = `[Verified] ${newFact}`;

                await Conversation.updateOne(
                    { userId, sessionId },
                    { $push: { 'smartContext.rolling.facts': formattedFact } }
                );
                LoggerService.info('fact_manually_corrected', { userId, sessionId, fact: newFact });
            } else if (type === 'intent') {
                const intentCorrection = correction as IntentCorrection;
                await Conversation.updateOne(
                    { userId, sessionId },
                    {
                        $set: {
                            'smartContext.rolling.intent.primary': intentCorrection.primary,
                            'smartContext.rolling.intent.secondary': intentCorrection.secondary || [],
                            'smartContext.rolling.intent.confidence': 1.0
                        }
                    }
                );
                LoggerService.info('intent_manually_corrected', { userId, sessionId, intent: intentCorrection.primary });
            }
        } catch (e) {
            LoggerService.error('Manual Correction Failed', e);
        }
    }

    static async generateRollingSummary(
        currentRolling: RollingContext,
        newMessages: ChatMessage[],
        userId?: string
    ): Promise<RollingContext> {
        // ChatMessage.content is always string per the shared type definition
        const extractText = (content: string | undefined): string => String(content || '');

        const prompt = `
Current Rolling:
${JSON.stringify(currentRolling, null, 2)}

New Messages:
${newMessages.map(m => `${m.role}: ${extractText(m.content)}`).join('\n')}
`;

        let response = '';
        try {
            const { text, usage } = await BedrockService.sendChat(
                SYSTEM_MODELS.SUMMARIZE,
                [{ role: 'user', content: prompt }],
                SummarizationService.ROLLING_PROMPT,
                0.1
            );
            response = text;

            if (usage) {
                await LoggerService.info('chat_completion', {
                    tokens: usage,
                    weightedTokens: computeWeightedTokens(usage.total || 0, SYSTEM_MODELS.SUMMARIZE),
                    model: SYSTEM_MODELS.SUMMARIZE,
                    action: 'rolling_summary',
                    isBackground: true
                }, userId);
            }

            // Robust SENTINEL Parsing
            const jsonMatch = response.match(/<json>([\s\S]*?)<\/json>/);
            const rawJson = jsonMatch ? jsonMatch[1].trim() : response.trim();

            const parsed = JSON.parse(rawJson);

            // Schema Validation & Clamping
            return {
                facts: Array.isArray(parsed.facts) ? parsed.facts : (currentRolling.facts || []),
                tentative_facts: Array.isArray(parsed.tentative_facts) ? parsed.tentative_facts : [],
                intent: {
                    primary: parsed.intent?.primary || (currentRolling.intent?.primary || 'Unknown'),
                    secondary: Array.isArray(parsed.intent?.secondary) ? parsed.intent.secondary : (currentRolling.intent?.secondary || []),
                    confidence: Math.max(0, Math.min(1, typeof parsed.intent?.confidence === 'number' ? parsed.intent.confidence : 1.0))
                },
                constraints: Array.isArray(parsed.constraints) ? parsed.constraints : (currentRolling.constraints || []),
                decisions: Array.isArray(parsed.decisions) ? parsed.decisions : (currentRolling.decisions || []),
                open_questions: Array.isArray(parsed.open_questions) ? parsed.open_questions : (currentRolling.open_questions || []),
                confidence_score: Math.max(0, Math.min(1, typeof parsed.confidence_score === 'number' ? parsed.confidence_score : 1.0))
            };

        } catch (e: any) {
            LoggerService.warn('Rolling Summary Parse Failed - Falling back to current context', { error: e.message, response });
            return currentRolling;
        }
    }

    static async canonize(
        currentCanonical: string,
        rollingContext: RollingContext,
        userId?: string
    ): Promise<string> {
        const prompt = `
Current Canonical:
${currentCanonical}

Rolling Context to Merge:
${JSON.stringify(rollingContext, null, 2)}
`;

        try {
            const { text: response, usage } = await BedrockService.sendChat(
                SYSTEM_MODELS.SUMMARIZE,
                [{ role: 'user', content: prompt }],
                SummarizationService.CANONIZATION_PROMPT,
                0.1
            );

            if (usage) {
                await LoggerService.info('chat_completion', {
                    tokens: usage,
                    weightedTokens: computeWeightedTokens(usage.total || 0, SYSTEM_MODELS.SUMMARIZE),
                    model: SYSTEM_MODELS.SUMMARIZE,
                    action: 'canonization',
                    isBackground: true
                }, userId);
            }
            return response.trim();
        } catch (e) {
            LoggerService.error('Canonization LLM call failed', e);
            return currentCanonical;
        }
    }

    static async updateTitle(userId: string, sessionId: string, firstMessage: string): Promise<string | null> {
        try {
            // Check if title already exists
            const conversation = await Conversation.findOne({ userId, sessionId }).select('metadata.title');
            if (conversation?.metadata?.title) return conversation.metadata.title;

            // Updated prompt to enforce plain text explicitly, without formatting issues
            const prompt = `Generate a very short, catchy 3-5 word title for a conversation starting with: "${firstMessage}"
            Output exactly the string, without any quotes, brackets, or other punctuation.`;

            const { text: rawTitle, usage } = await BedrockService.sendChat(
                SYSTEM_MODELS.UTILITY,
                [{ role: 'user', content: prompt }],
                'You are a title writer.',
                0.2
            );

            if (usage) {
                await LoggerService.info('chat_completion', {
                    tokens: usage,
                    weightedTokens: computeWeightedTokens(usage.total || 0, SYSTEM_MODELS.UTILITY),
                    model: SYSTEM_MODELS.UTILITY,
                    action: 'title_generation',
                    isBackground: true
                }, userId);
            }

            const cleanedTitle = rawTitle.replace(/["'{}\[\]]/g, '').trim();

            await Conversation.updateOne(
                { userId, sessionId },
                { $set: { 'metadata.title': cleanedTitle } }
            );
            LoggerService.info('conversation_titled', { sessionId, title: cleanedTitle });
            return cleanedTitle;
        } catch (e) {
            LoggerService.error('Auto-naming failed', e);
            return null;
        }
    }
}

