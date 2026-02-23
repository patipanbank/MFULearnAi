import { MODELS, SYSTEM_MODELS } from '../config/models';
import axios from 'axios';
import { LoggerService } from '../services/LoggerService';
import { TokenUtil } from './tokenUtils';

const BEDROCK_ENDPOINT = process.env.BEDROCK_TEXT_URL || 'http://bedrock-text:5001/api/bedrock';

/**
 * ReRankerService — Uses a lightweight LLM to re-rank RAG search results
 * by relevance to the user's query and intent.
 *
 * Note: Currently not invoked from the search pipeline (CQ-13).
 * Wire into KnowledgeService.search() when ready to enable LLM re-ranking.
 */
export class ReRankerService {
    static async reRank(query: string, intent: string, candidates: Array<{ score: number; content: string }>): Promise<Array<{ score: number; content: string }>> {
        if (candidates.length <= 1) return candidates;

        try {
            const token = TokenUtil.mint('mfu-bedrock-service');
            const prompt = `
You are a Search Specialist. Your task is to re-rank the following document chunks based on their relevance to the user's query and intent.
User Query: "${query}"
User Intent: "${intent}"

Chunks to evaluate:
${candidates.map((c, i) => `[ID: ${i}] (Score: ${c.score.toFixed(3)}) ${c.content.substring(0, 500)}...`).join('\n\n')}

Task: 
1. Determine which 5 chunks most accurately and concisely answer the query.
2. Return strictly a JSON array of indices in order of relevance.
3. Example: [3, 0, 1]
`;

            const response = await axios.post(`${BEDROCK_ENDPOINT}/chat`, {
                modelId: SYSTEM_MODELS.RERANK,
                messages: [{ role: 'user', content: prompt }],
                stream: false,
                options: { temperature: 0.1 }
            }, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.data && response.data.content) {
                let textContent = '';
                if (Array.isArray(response.data.content)) {
                    textContent = response.data.content
                        .filter((b: { type: string }) => b.type === 'text')
                        .map((b: { text: string }) => b.text)
                        .join('');
                } else if (typeof response.data.content === 'string') {
                    textContent = response.data.content;
                }

                if (textContent) {
                    const match = textContent.match(/\[.*\]/);
                    if (match) {
                        const indices = JSON.parse(match[0]);
                        return indices.map((idx: number) => candidates[idx]).filter(Boolean);
                    }
                }
            }
        } catch (e: any) {
            LoggerService.warn('reranker_failed', { error: e.message, fallback: 'original_order' });
        }
        return candidates.slice(0, 5); // Fallback to top 5
    }
}
