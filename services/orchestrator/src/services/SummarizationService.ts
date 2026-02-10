import { BedrockService } from './BedrockService';
import { HistoryService } from './HistoryService';
import { LoggerService } from './LoggerService';
import { ExecutionTrace, Intent } from './agent/types';
import crypto from 'crypto';

interface SmartContext {
    canonical: string;
    rolling: {
        facts: string[];
        tentative_facts: string[]; // Kept for schema compatibility
        intent: string;
        constraints: string[];
        decisions: string[];
        open_questions: string[];
        confidence_score: number;
    };
    version: number;
    hashes: { canonical: string; rolling: string; raw: string };
    lastCanonizedAt: Date;
    metadata?: {
        intent_history?: string[];
        volatility_score?: number;
    };
}

export class SummarizationService {
    private static CANONIZATION_INTERVAL = 5;

    // R1.1: Passive Recording. No autonomous intent inference.
    static async updateContextFromTrace(
        userId: string,
        sessionId: string,
        intent: Intent,
        trace: ExecutionTrace,
        finalAnswer: string,
        currentContext: SmartContext
    ) {
        try {
            // 1. Update Rolling Context with DEFINITIVE data from the Interaction
            const newRolling = { ...currentContext.rolling };

            // Intent is EXPLICIT from the Analyzer, not inferred.
            // Intent is EXPLICIT from the Analyzer, not inferred.
            // Schema expects a String, so we just use the primary intent.
            newRolling.intent = intent;

            // Extract facts/results from SUCCESSFUL trace steps
            // This is "Ground Truth" data from tools
            const newFacts: string[] = [];
            trace.steps.forEach(step => {
                if (step.status === 'SUCCESS' && step.output) {
                    // We could format this better, but for now:
                    const fact = `Verified [${step.tool}]: ${JSON.stringify(step.output).substring(0, 100)}`;
                    newFacts.push(fact);
                }
            });

            newRolling.facts = [...(newRolling.facts || []), ...newFacts];

            // 2. Logic Check: Should we Summarize/Canonize?
            // Simple heuristic for now: Every 5 turns or if facts grow too large
            const targetVersion = currentContext.version + 1;

            // ... (Simplified logic for refactor scope) ...
            // Just save the new state

            const nextContext: SmartContext = {
                ...currentContext,
                rolling: newRolling,
                version: targetVersion,
                lastCanonizedAt: currentContext.lastCanonizedAt || new Date()
            };

            await HistoryService.updateSmartContext(userId, sessionId, nextContext);
            LoggerService.info('Smart Context Updated (Passive)', { intent, factsAdded: newFacts.length });

        } catch (e) {
            LoggerService.error('Summarization Update Failed', e);
        }
    }

    // Compatibility for ChatWorkflow (Legacy/Direct Chat)
    static async runUpdate(
        userId: string,
        sessionId: string,
        newMessages: any[],
        currentContext: SmartContext
    ) {
        // Passive update for direct chat: just act as a pass-through or simple logger for now.
        // In V2.1, we prefer updateContextFromTrace, but ChatWorkflow doesn't produce traces yet.
        try {
            // Simple: Update version and timestamp
            const nextContext: SmartContext = {
                ...currentContext,
                version: currentContext.version + 1,
                lastCanonizedAt: new Date()
            };
            await HistoryService.updateSmartContext(userId, sessionId, nextContext);
        } catch (e) {
            LoggerService.error('Legacy Summarization Update Failed', e);
        }
    }

    // Keep Canonization logic for condensing history, but trigger it explicitly?
    // For now, let's keep the method but it is called less often or mainly for compacting text.
    static async canonize(
        currentCanonical: string,
        newFacts: string[]
    ): Promise<string> {
        // ... Implementation if needed ...
        return currentCanonical;
    }
}
