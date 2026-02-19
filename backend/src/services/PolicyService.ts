import { KnowledgeService } from './KnowledgeService';
import { LoggerService } from './LoggerService';

export class PolicyService {
    /**
     * Checks if the user's query relates to University Policy and retrieves relevant context.
     * Uses "Search Score as Intent" pattern.
     */
    static async check(query: string, userContext: any): Promise<{ policyContext: string | null, isRelevant: boolean }> {
        // 1. Query Expansion (Simple)
        // Add robust keywords to ensure semantic overlap with formal policy documents
        const expandedQuery = `${query} policy regulation rule university guideline fee deadline schedule academic grading registration`;

        // 2. Search
        // We use a specific metadata filter to target only policy documents.
        // This assumes documents are ingested with { type: 'policy' } metadata.
        // If not, this returns strictly nothing (Fail Closed).
        const filter = { type: 'policy' };

        try {
            const { blocks, maxScore } = await KnowledgeService.search(
                expandedQuery,
                userContext,
                {
                    minScore: 0.5, // Minimum threshold to consider even looking at it
                    intent: 'POLICY_CHECK',
                    metadataFilter: filter
                }
            );

            // 3. Threshold Logic
            // < 0.5: Irrelevant (Already filtered by minScore, but double check)
            if (maxScore < 0.5 || blocks.length === 0) {
                return { policyContext: null, isRelevant: false };
            }

            // 0.5 - 0.7: Soft Relevance (Maybe) -> We inject it but might qualify it?
            // > 0.7: High Relevance -> We definitively inject it.
            // For now, we inject both but logs distinguish. 
            // The System Prompt will handle the "nuance" based on the content itself.

            LoggerService.info('policy_hit', { query, maxScore, blocks: blocks.length });

            // 4. Construct Context
            let context = `=== UNIVERSITY POLICY CONTEXT (Relevance: ${maxScore.toFixed(2)}) ===\n`;
            context += `The following official regulations may apply to the user's request. STRICTLY FOLLOW THESE RULES.\n\n`;

            // Group by Source to be clean
            const contentBySource = new Map<string, string[]>();
            blocks.forEach(b => {
                const source = b.metadata.fileName || 'Unknown Policy';
                if (!contentBySource.has(source)) contentBySource.set(source, []);
                contentBySource.get(source)?.push(b.content);
            });

            contentBySource.forEach((contents, source) => {
                context += `[Source: ${source}]\n${contents.join('\n...\n')}\n\n`;
            });

            return { policyContext: context, isRelevant: true };

        } catch (error: any) {
            LoggerService.error('PolicyService_Check_Failed', { error: error.message });
            return { policyContext: null, isRelevant: false };
        }
    }
}
