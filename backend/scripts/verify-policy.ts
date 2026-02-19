
import { PolicyService } from '../src/services/PolicyService';
import { KnowledgeService } from '../src/services/KnowledgeService';
import { SearchTool } from '../src/tools/SearchTool';

// Mock KnowledgeService.search
KnowledgeService.search = async (query: string, userContext: any, options: any) => {
    console.log(`[MockKnowledgeService] Query: "${query}"`);
    console.log(`[MockKnowledgeService] Options:`, options);

    // Simulate Policy Hit (tuition)
    if (query.includes('tuition') || query.includes('fee')) {
        return {
            text: '<block id="b1" score="0.88">Ref: Tuition Fee Regulation 2024. Students must pay by...</block>',
            sources: [{ id: '1', name: 'TuitionPolicy.pdf' }],
            blocks: [{
                content: 'Ref: Tuition Fee Regulation 2024. Students must pay by...',
                metadata: { fileName: 'TuitionPolicy.pdf', fileId: '1', page: 1, score: 0.88 },
                type: 'text',
                id: 'b1'
            }],
            maxScore: 0.88
        };
    }

    // Simulate Irrelevant (hello)
    return {
        text: '',
        sources: [],
        blocks: [],
        maxScore: 0.1
    };
};

async function runTest() {
    console.log('\n--- Test 1: PolicyService Relevant Query (Tuition) ---');
    const res1 = await PolicyService.check('How much is tuition fee?', { userId: 'test', role: 'student', department: 'General' });
    console.log('Result:', JSON.stringify(res1, null, 2));

    console.log('\n--- Test 2: PolicyService Irrelevant Query (Hello) ---');
    const res2 = await PolicyService.check('Hello world', { userId: 'test', role: 'student', department: 'General' });
    console.log('Result:', JSON.stringify(res2, null, 2));

    console.log('\n--- Test 3: SearchTool Query Expansion & Format ---');
    const tool = new SearchTool();
    const res3 = await tool.execute(
        { query: 'tuition', context: 'late payment' },
        { userId: 'test', role: 'student', department: 'General' }
    );
    console.log('SearchTool Result:', JSON.stringify(res3, null, 2));
}

runTest().catch(console.error);
