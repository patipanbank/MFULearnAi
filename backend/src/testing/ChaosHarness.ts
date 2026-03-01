import { HistoryService } from '../services/HistoryService';
import { LoggerService } from '../services/LoggerService';

export class ChaosHarness {
    /**
     * Scenario 1: Token Starvation
     * Drastically truncates history to see if the engine can still function with only Canonical memory.
     */
    static async simulateTokenStarvation(userId: string, sessionId: string) {
        LoggerService.warn('chaos_token_starvation_start', { userId, sessionId });
        const { messages } = await HistoryService.getContext(userId, sessionId);

        // Drop all but the last message to simulate extreme truncation
        const truncated = messages.slice(-1);
        await HistoryService.saveToPersistentStorage(userId, sessionId, truncated, {}, 'TEST', 'haiku');

        LoggerService.info('chaos_token_starvation_complete', { dropped: messages.length - 1 });
    }

    /**
     * Scenario 2: Memory Poisoning
     * Injects a conflicting fact into the rolling context to test confidence damping or cancellation.
     */
    static async simulateMemoryPoisoning(userId: string, sessionId: string, poisonFact: string) {
        LoggerService.warn('chaos_memory_poisoning_start', { userId, sessionId, poisonFact });
        const { smartContext } = await HistoryService.getContext(userId, sessionId);
        if (smartContext) {
            smartContext.rolling.facts.push(poisonFact);
            await HistoryService.updateSmartContext(userId, sessionId, smartContext);
        }
    }

    /**
     * Scenario 3: Context Flood
     * Injects many turns of noise to test if discovery gating still works.
     */
    static async simulateContextFlood(userId: string, sessionId: string, turnCount: number = 20) {
        LoggerService.warn('chaos_context_flood_start', { userId, sessionId, turnCount });
        for (let i = 0; i < turnCount; i++) {
            await HistoryService.addMessage(userId, sessionId, {
                role: 'user',
                content: `Noise message ${i}: What is the weather like in a random city?`,
                timestamp: new Date()
            });
            await HistoryService.addMessage(userId, sessionId, {
                role: 'assistant',
                content: `I am a helpful assistant. I don't know the weather for noise message ${i}.`,
                timestamp: new Date()
            });
        }
        LoggerService.info('chaos_context_flood_complete');
    }
}
