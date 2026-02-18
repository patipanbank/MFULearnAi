// ReRankerService handles document validation via Bedrock
// Wait, Knowledge Service doesn't have BedrockService imported.
// I should either:
// A. Call Bedrock directly from Knowledge (need access/env)
// B. Make Knowledge call Orchestrator (circular?)
// C. Knowledge implements its own Bedrock client.

// Analysis: Knowledge service already has getEmbedding which calls a Bedrock-Proxy.
// I'll implement a simple sendChat counterpart in Knowledge service for re-ranking.

import { MODELS } from '../config/models';
import axios from 'axios';
const BEDROCK_ENDPOINT = process.env.BEDROCK_TEXT_URL || 'http://bedrock-text:5001/api/bedrock';
import { TokenUtil } from './tokenUtils';

export class ReRankerService {
    static async reRank(query: string, intent: string, candidates: any[]): Promise<any[]> {
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
                modelId: MODELS.PRIMARY,
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
                        .filter((b: any) => b.type === 'text')
                        .map((b: any) => b.text)
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
        } catch (e) {
            console.warn('[ReRanker] Re-ranking failed, falling back to original order.', e);
        }
        return candidates.slice(0, 5); // Fallback to top 5
    }
}
