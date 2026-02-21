import { KnowledgeService } from './KnowledgeService';
import { BedrockService } from './BedrockService';
import { LoggerService } from './LoggerService';
import { SYSTEM_MODELS } from '../config/models';

export class PolicyService {

    /**
     * Use a lightweight LLM to rewrite the user's query into effective
     * bilingual (Thai + English) search keywords for policy retrieval.
     * Falls back to raw query on failure.
     */
    private static async rewriteQuery(userQuery: string): Promise<string> {
        try {
            const prompt = `You are a university policy search assistant.

Step 1 - Analyze: Identify what policy, regulation, or rule aspects are implied by the question.
Step 2 - Generate: Create 5-8 search keywords focused ONLY on the policy/regulatory angle, in both Thai and English.

Rules:
- Output format: "Analysis: <one line> | Keywords: <comma-separated>"
- Keywords must reflect policy/regulatory terms, NOT general topic terms
- Include formal Thai legal/regulatory terminology where applicable

Examples:
Q: "ผมขโมยกระเป๋าเงินมาผมผิดอะไรบ้าง"
Analysis: relates to theft which may involve student disciplinary rules and legal liability
Keywords: ระเบียบวินัยนักศึกษา, misconduct, disciplinary action, บทลงโทษ, ความรับผิดทางกฎหมาย, student conduct

Q: "ลาป่วยได้กี่วัน"
Analysis: relates to leave policy and attendance regulations
Keywords: การลาป่วย, sick leave policy, ระเบียบการลา, leave of absence, attendance regulation

Question: "${userQuery}"`;

            const { text } = await BedrockService.sendChat(
                SYSTEM_MODELS.UTILITY,
                [{ role: 'user', content: prompt }],
                undefined, // no system prompt
                0.1 // low temp for deterministic output
            );

            const output = text.trim();
            const keywordMatch = output.match(/Keywords:\s*(.+)/);
            const keywords = keywordMatch?.[1]?.trim() || '';

            LoggerService.info('policy_query_rewrite', {
                original: userQuery,
                analysis: output.match(/Analysis:\s*(.+)/)?.[1]?.trim(),
                keywords
            });

            return keywords;

        } catch (error: any) {
            // Fail graceful: return empty string so raw query is still used
            LoggerService.warn('policy_query_rewrite_failed', { error: error.message });
            return '';
        }
    }

    /**
     * Checks if the user's query relates to University Policy and retrieves relevant context.
     * Uses LLM-based query rewriting + "Search Score as Intent" pattern.
     */
    static async check(query: string, userContext: any): Promise<{ policyContext: string | null, isRelevant: boolean }> {
        // 1. Query Rewriting (LLM-based bilingual expansion)
        const keywords = await this.rewriteQuery(query);
        const expandedQuery = keywords ? `${query} ${keywords}` : query;

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

            LoggerService.info('policy_hit', { query, expandedQuery, maxScore, blocks: blocks.length });

            // 4. Construct Context — explicitly tell AI this is KB-sourced
            let context = `=== UNIVERSITY POLICY CONTEXT (Retrieved from Knowledge Base, Relevance: ${maxScore.toFixed(2)}) ===\n`;
            context += `IMPORTANT: This policy content was ALREADY SEARCHED AND RETRIEVED from the Knowledge Base for you. The 'search' tool EXCLUDES policy documents by design — do NOT use it to re-search for policies. Base your answer on the content below.\n\n`;

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
