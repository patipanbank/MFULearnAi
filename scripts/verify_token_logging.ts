
import { SummarizationService } from '../services/orchestrator/src/services/SummarizationService';
import { BedrockService } from '../services/orchestrator/src/services/BedrockService';
import { LoggerService } from '../services/orchestrator/src/services/LoggerService';
import { MODELS } from '../services/orchestrator/src/config/models';

// Mocks
const mockUsage = { input: 10, output: 20, total: 30 };
BedrockService.sendChat = async (...args: any[]) => {
    console.log('[Mock] BedrockService.sendChat called');
    return {
        text: '<json>{"facts": ["fact1"], "confidence_score": 0.9}</json>',
        usage: mockUsage
    };
};

const loggedEvents: any[] = [];
LoggerService.info = async (action: string, context: any) => {
    console.log(`[Mock] LoggerService.info called: ${action}`, context);
    loggedEvents.push({ action, context });
};
LoggerService.error = async (action: string, context: any) => {
    console.error(`[Mock] LoggerService.error called: ${action}`, context);
};

async function verifyFix() {
    console.log('--- Verifying SummarizationService Token Logging ---');

    // Test 1: Rolling Summary
    console.log('\nTest 1: Rolling Summary');
    const currentRolling = { facts: [], intent: { primary: 'test', confidence: 1 } };
    await SummarizationService.generateRollingSummary(currentRolling, [{ role: 'user', content: 'hello' }]);

    const rollingLog = loggedEvents.find(e => e.action === 'rolling_summary' || (e.action === 'chat_completion' && e.context.action === 'rolling_summary'));
    if (rollingLog && rollingLog.context.tokens) {
        console.log('✅ Rolling Summary logged tokens:', rollingLog.context.tokens);
    } else {
        console.error('❌ Failed to log tokens for Rolling Summary');
    }

    // Test 2: Canonization
    console.log('\nTest 2: Canonization');
    await SummarizationService.canonize('canonical', currentRolling);

    const canonLog = loggedEvents.find(e => e.action === 'canonization' || (e.action === 'chat_completion' && e.context.action === 'canonization'));
    if (canonLog && canonLog.context.tokens) {
        console.log('✅ Canonization logged tokens:', canonLog.context.tokens);
    } else {
        console.error('❌ Failed to log tokens for Canonization');
    }

    // Test 3: Title Generation
    console.log('\nTest 3: Title Generation');
    // Mock Bedrock for title specifically if needed, but the generic mock works
    // We need to mock Conversation.findOne to return null so it proceeds to generation
    const Conversation = require('../services/orchestrator/src/models/Conversation').Conversation;
    Conversation.findOne = async () => null;
    Conversation.updateOne = async () => { };

    await SummarizationService.updateTitle('user1', 'session1', 'hello');

    const titleLog = loggedEvents.find(e => e.action === 'title_generation' || (e.action === 'chat_completion' && e.context.action === 'title_generation'));
    if (titleLog && titleLog.context.tokens) {
        console.log('✅ Title Generation logged tokens:', titleLog.context.tokens);
    } else {
        console.error('❌ Failed to log tokens for Title Generation');
    }
}

// Run (needs ts-node or similar, assume environment is set up)
verifyFix().catch(console.error);
