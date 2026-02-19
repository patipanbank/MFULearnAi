
import { PromptBuilder } from './PromptBuilder';
import { AgentContext, WorkflowState } from '../types/AgentTypes';

const mockContext: AgentContext = {
    message: 'How much is the tuition fee?',
    images: [],
    userId: 'test-user',
    collectionId: 'test-collection'
} as any;

const mockState: WorkflowState = {
    smartContext: { canonical: 'Canonical memory.', rolling: { foo: 'bar' } },
    nativeDocBlocks: [],
    extractedTextBlocks: [],
    history: Array(15).fill({ role: 'user', content: 'hello' }) // 15 messages
} as any;

try {
    const result = PromptBuilder.buildInitialMessages(mockContext, mockState);
    const systemMessage = result.find(m => m.role === 'system');

    if (!systemMessage) {
        throw new Error('No system message found');
    }

    const systemText = (systemMessage.content as any[]).map(b => b.text).join('\n');

    console.log('--- System Prompt Content ---');
    console.log(systemText);
    console.log('-----------------------------');

    if (systemText.includes('1. Tool Results (Search/Calc)')) {
        console.log('PASS: Truth Priority correct');
    } else {
        console.error('FAIL: Truth Priority incorrect');
    }

    if (systemText.includes("Use 'search' when the question involves specific organizational data")) {
        console.log('PASS: Trigger condition found');
    } else {
        console.error('FAIL: Trigger condition missing');
    }

    // Check history slicing
    const historyMessages = result.filter(m => m.role === 'user' || m.role === 'assistant');
    // Result has system + history + 1 user (current)
    // History should be 10 messages max.
    // Total should be 1 (system) + 10 (history) + 1 (current) = 12
    if (result.length === 12) {
        console.log('PASS: History sliced correctly (10 items)');
    } else {
        console.error(`FAIL: History slice incorrect. Length: ${result.length}`);
    }

} catch (error) {
    console.error('Test Failed:', error);
}
