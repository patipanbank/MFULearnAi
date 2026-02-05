import { BedrockService } from './BedrockService';
import { HistoryService } from './HistoryService';
import { LoggerService } from './LoggerService';
import crypto from 'crypto';

interface SmartContext {
    canonical: string;
    rolling: {
        facts: string[];
        tentative_facts?: string[];
        intent: {
            primary: string;
            secondary?: string[];
            confidence: number;
        };
        constraints: string[];
        decisions: string[];
        open_questions: string[];
        confidence_score: number;
    };
    version: number;
    hashes: { canonical: string; rolling: string; raw: string };
    lastCanonizedAt: Date;
}

export class SummarizationService {
    private static ROLLING_INTERVAL = 1;
    private static CANONIZATION_INTERVAL = 5;

    private static ROLLING_PROMPT = `
You are a Memory Manager AI. Your goal is to update the "Rolling Context" based on the latest conversation.
Output strictly in JSON within <json> sentinel tags.

Input:
- Current Rolling Context (JSON)
- New Messages

Task:
1. Update 'facts' with new critical information.
2. Update 'tentative_facts' for items that seem uncertain or need verification.
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
3. Do NOT include temporary chit-chat.

Output: Updated Canonical Memory (Text only).
`;

    static async runUpdate(
        userId: string,
        sessionId: string,
        newMessages: any[],
        currentContext: SmartContext
    ) {
        try {
            // 1. Generate New Rolling Summary
            const newRolling = await this.generateRollingSummary(currentContext.rolling, newMessages);

            // 1.1 TENTATIVE PROMOTION (Semantic Normalization)
            // Improved: Use normalized keys to prevent "Paraphrase Skew"
            const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
            const previousTentativeMap = new Map((currentContext.rolling.tentative_facts || []).map(f => [normalize(f), f]));

            const promotedFacts: string[] = [];
            const remainingTentative: string[] = [];

            if (newRolling.tentative_facts) {
                for (const fact of newRolling.tentative_facts) {
                    const norm = normalize(fact);
                    if (previousTentativeMap.has(norm)) {
                        promotedFacts.push(fact); // Promoted!
                    } else {
                        remainingTentative.push(fact);
                    }
                }
            }

            newRolling.facts = [...(newRolling.facts || []), ...promotedFacts];
            newRolling.tentative_facts = remainingTentative;

            // 1.2 HEURISTIC REFINEMENT
            const currentTotal = (currentContext.rolling.facts?.length || 0) +
                (currentContext.rolling.tentative_facts?.length || 0) +
                (currentContext.rolling.decisions?.length || 0);
            const newTotal = (newRolling.facts?.length || 0) +
                (newRolling.tentative_facts?.length || 0) +
                (newRolling.decisions?.length || 0);

            const factDelta = Math.abs(newTotal - currentTotal);

            if (newMessages.length > 2 && factDelta === 0 && newRolling.confidence_score > 0.8) {
                newRolling.confidence_score *= 0.8;
                LoggerService.info(`[SmartContext] Damping confidence due to zero state change in ${sessionId}`);
            }

            // 2. Check Canonization Trigger
            let newCanonical = currentContext.canonical;
            const targetVersion = currentContext.version + 1;
            const shouldCanonize = targetVersion % this.CANONIZATION_INTERVAL === 0 && newRolling.confidence_score >= 0.7;

            // Idempotency: Use core fields (facts + decisions + constraints) for hash
            const coreState = {
                f: newRolling.facts,
                d: newRolling.decisions,
                c: newRolling.constraints
            };
            const rollingHash = crypto.createHash('sha256').update(JSON.stringify(coreState)).digest('hex');
            const isDuplicate = currentContext.hashes.rolling === rollingHash;

            if (shouldCanonize) {
                if (isDuplicate) {
                    LoggerService.info(`[SmartContext] Canonization skipped: Idempotent (Hash: ${rollingHash.substring(0, 8)})`);
                } else {
                    newCanonical = await this.canonize(currentContext.canonical, newRolling);
                    LoggerService.info(`[SmartContext] Canonization successful for ${sessionId}`);
                }
            } else if (targetVersion % this.CANONIZATION_INTERVAL === 0) {
                LoggerService.warn(`[SmartContext] Canonization skipped for ${sessionId}. Confidence: ${newRolling.confidence_score}, Duplicate: ${isDuplicate}`);
            }

            // 3. Generate Hashes for Integrity Tracking
            const messagesStr = JSON.stringify(newMessages);

            const nextContext: SmartContext = {
                canonical: newCanonical,
                rolling: newRolling,
                version: targetVersion,
                hashes: {
                    canonical: shouldCanonize && !isDuplicate ? crypto.createHash('sha256').update(newCanonical).digest('hex') : currentContext.hashes.canonical,
                    rolling: rollingHash,
                    raw: crypto.createHash('sha256').update(messagesStr).digest('hex')
                },
                lastCanonizedAt: (shouldCanonize && !isDuplicate) ? new Date() : currentContext.lastCanonizedAt
            };

            await HistoryService.updateSmartContext(userId, sessionId, nextContext);
            LoggerService.info(`[SmartContext] Version ${nextContext.version} saved. State Hash: ${rollingHash.substring(0, 8)}`);

            // Guard: Canonical Length (Soft Warning)
            if (newCanonical.length > 5000) {
                LoggerService.warn(`[SmartContext] Canonical memory for ${sessionId} is getting large (${newCanonical.length} chars). Consider auto-summarization.`);
            }

        } catch (e) {
            LoggerService.error('Summarization Pipeline Failed', e instanceof Error ? { message: e.message, stack: e.stack } : e);
            // Signal failure to monitoring (LoggerService already handles basic error logging)
        }
    }

    static async handleManualCorrection(userId: string, sessionId: string, type: 'fact' | 'intent', correction: any) {
        try {
            const { smartContext } = await HistoryService.getContext(userId, sessionId);
            if (!smartContext) return;

            if (type === 'fact') {
                // If user corrects a fact, it goes straight to tentative but tagged as "Verified"
                // We'll prefix it or use a separate verification flag if we had one.
                // For now, let's just push it to rolling facts but force a low-latency canonization if needed.
                const newFact = typeof correction === 'string' ? correction : correction.text;
                smartContext.rolling.facts = [...(smartContext.rolling.facts || []), `[Verified] ${newFact}`];
                LoggerService.info('fact_manually_corrected', { userId, sessionId, fact: newFact });
            } else if (type === 'intent') {
                smartContext.rolling.intent = {
                    primary: correction.primary,
                    secondary: correction.secondary || [],
                    confidence: 1.0 // Manual correction is always 100% confident
                };
                LoggerService.info('intent_manually_corrected', { userId, sessionId, intent: correction.primary });
            }

            await HistoryService.updateSmartContext(userId, sessionId, smartContext);
        } catch (e) {
            LoggerService.error('Manual Correction Failed', e);
        }
    }

    static async generateRollingSummary(
        currentRolling: any,
        newMessages: any[]
    ): Promise<any> {
        const prompt = `
Current Rolling:
${JSON.stringify(currentRolling, null, 2)}

New Messages:
${newMessages.map(m => `${m.role}: ${m.content}`).join('\n')}
`;

        try {
            const response = await BedrockService.sendChat(
                'anthropic.claude-3-haiku-20240307-v1:0',
                [{ role: 'user', content: prompt }],
                SummarizationService.ROLLING_PROMPT,
                0.1
            );

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
            LoggerService.warn('Rolling Summary Parse Failed - Falling back to current context', { error: e.message });
            return currentRolling;
        }
    }

    static async canonize(
        currentCanonical: string,
        rollingContext: any
    ): Promise<string> {
        const prompt = `
Current Canonical:
${currentCanonical}

Rolling Context to Merge:
${JSON.stringify(rollingContext, null, 2)}
`;

        try {
            const response = await BedrockService.sendChat(
                'anthropic.claude-3-sonnet-20240229-v1:0',
                [{ role: 'user', content: prompt }],
                SummarizationService.CANONIZATION_PROMPT,
                0.1
            );
            return response.trim();
        } catch (e) {
            LoggerService.error('Canonization LLM call failed', e);
            return currentCanonical;
        }
    }
}
