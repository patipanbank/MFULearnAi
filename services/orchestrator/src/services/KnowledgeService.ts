import axios from '../config/axios';
import FormData from 'form-data';
import { CanonicalIR } from '../../../../shared/types';
import { TokenService } from './TokenService';
import { LoggerService } from './LoggerService';

const KNOWLEDGE_URL = process.env.KNOWLEDGE_URL || 'http://localhost:7000/api/knowledge';

export class KnowledgeService {
    static async search(query: string, userContext: any, collectionId?: string, intent: string = 'QUERY'): Promise<{ text: string, sources: Array<{ id: string, name: string }>, blocks: CanonicalIR['blocks'], maxScore?: number }> {
        try {
            const payload: any = { query, limit: 3, intent };
            if (collectionId) payload.collectionId = collectionId;

            const headers: any = {
                'x-user-id': userContext.userId,
                'x-role': userContext.role,
                'x-department': userContext.department || 'General',
                'Authorization': `Bearer ${TokenService.mint('knowledge', 'read')}`
            };

            const response = await axios.post(`${KNOWLEDGE_URL}/search`, payload, { headers });

            if (response.data && response.data.results) {
                LoggerService.info('rag_search_raw_results', {
                    count: response.data.results.length,
                    intent,
                    query
                });

                // Track unique sources with ID, Name, and canView permission
                const sourceMap = new Map<string, any>();
                response.data.results.forEach((hit: any) => {
                    const kid = hit.metadata.knowledgeId;
                    if (kid && !sourceMap.has(kid)) {
                        // Privacy Logic:
                        // 1. Owner can always view
                        // 2. Admin of the same department can view
                        // 3. Public knowledge is viewable by its department admins (Adjust if public means really public)
                        const isOwner = userContext.userId === hit.metadata.ownerId;
                        const isAdminOfDept = userContext.role === 'admin' && userContext.department === hit.metadata.department;
                        const canView = isOwner || isAdminOfDept;

                        sourceMap.set(kid, {
                            id: kid,
                            name: hit.metadata.source,
                            canView
                        });
                    }
                });

                const sources = Array.from(sourceMap.values());
                const blocks = response.data.results.map((hit: any, index: number) => ({
                    id: hit.id || `search_b${index}`, // R4: Deterministic ID
                    content: hit.content,
                    type: 'paragraph',
                    metadata: {
                        fileId: hit.metadata.knowledgeId,
                        fileName: hit.metadata.source,
                        page: hit.metadata.page,
                        bbox: hit.metadata.bbox
                    }
                }));

                const text = response.data.results
                    .map((hit: any, index: number) => {
                        const blockId = blocks[index].id;
                        // R4: Remove [Source: ...] leak. XML only.
                        return `<block id="${blockId}">\n${hit.content}\n</block>`;
                    })
                    .join('\n\n');

                // Expose the highest score for confidence gating
                const maxScore = response.data.results.length > 0 ? Math.max(...response.data.results.map((r: any) => r.score || 0)) : 0;

                return { text, sources, blocks, maxScore };
            } else {
                LoggerService.warn('rag_search_no_results', { intent, query });
            }
        } catch (error: any) {
            console.warn('[KnowledgeService] Search failed:', error.message);
            return { text: '', sources: [], blocks: [], maxScore: 0 };
        }
        return { text: '', sources: [], blocks: [], maxScore: 0 };
    }

    static async parseFile(buffer: Buffer, filename: string, mimeType: string): Promise<CanonicalIR | null> {
        try {
            const formData = new FormData();
            formData.append('file', buffer, { filename, contentType: mimeType });

            const parseRes = await axios.post(`${KNOWLEDGE_URL}/parse`, formData, {
                headers: formData.getHeaders(),
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });

            if (parseRes.data.success) {
                return parseRes.data.ir;
            }
        } catch (e: any) {
            console.error(`[KnowledgeService] Failed to parse file ${filename}`, e.message);
        }
        return null;
    }

    static async view(id: string, userContext: any): Promise<any> {
        try {
            const headers: any = {
                'x-user-id': userContext.userId || 'system',
                'x-role': userContext.role || 'admin',
                'x-department': userContext.department || 'Global',
                'Authorization': `Bearer ${TokenService.mint('knowledge', 'read')}`
            };

            const response = await axios.get(`${KNOWLEDGE_URL}/${id}/view`, { headers });
            return response.data;
        } catch (error: any) {
            console.warn(`[KnowledgeService] View failed for ${id}:`, error.response?.data?.error || error.message);
            throw error;
        }
    }

    static async stream(id: string, userContext: any): Promise<any> {
        try {
            const headers: any = {
                'x-user-id': userContext.userId || 'system',
                'x-role': userContext.role || 'admin',
                'x-department': userContext.department || 'Global',
                'Authorization': `Bearer ${TokenService.mint('knowledge', 'read')}`
            };

            const response = await axios.get(`${KNOWLEDGE_URL}/${id}/stream`, {
                headers,
                responseType: 'stream'
            });
            return response;
        } catch (error: any) {
            console.warn(`[KnowledgeService] Stream failed for ${id}:`, error.response?.data?.error || error.message);
            throw error;
        }
    }

    // --- Phase 2: ChatGPT-Level RAG Methods ---

    /**
     * Assigns stable, conversation-local IDs to blocks.
     * Format: f{fileIdx}_b{blockIdx}
     */
    static assignBlockIds(fileParses: CanonicalIR[]): CanonicalIR[] {
        return fileParses.map((ir, fileIdx) => ({
            ...ir,
            blocks: ir.blocks.map((block, blockIdx) => ({
                ...block,
                id: `f${fileIdx + 1}_b${blockIdx + 1}`
            }))
        }));
    }

    /**
     * Performs a scoped search within attached file blocks (Local RAG).
     * Returns Top-K blocks sorted by relevance (Text Match / Mock Embedding).
     */
    static async searchLocal(query: string, fileParses: CanonicalIR[], limit: number = 15): Promise<CanonicalIR['blocks']> {
        // Text-based relevance heuristic (non-embedding)
        // Text-based relevance heuristic (non-embedding)
        // In a real system, this would use local vector search or embeddings.
        const allBlocks = fileParses.flatMap(f => f.blocks.map(b => ({
            ...b,
            // R4: Preserving Metadata
            metadata: {
                ...b.metadata,
                fileName: b.metadata.fileName || f.metadata?.detected_language || 'file',
                fileId: b.metadata.fileId // Ensure fileId is preserved if present
            }
        })));
        if (allBlocks.length === 0) return [];

        // In a real production system, you would use Embeddings (Cosine Similarity).
        // For this refactor, we will use a robust Text Match heuristic + random jitter for variety if text match fails
        // to simulate "semantic" selection without a local vector DB.

        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);

        const scored = allBlocks.map(block => {
            let score = 0;
            const content = block.content.toLowerCase();

            // 1. Exact Phrase Match
            if (content.includes(query.toLowerCase())) score += 10;

            // 2. Keyword Match
            terms.forEach(term => {
                if (content.includes(term)) score += 3;
            });

            // 3. Recency/Position Bias (Earlier blocks in doc often contain intros/summaries)
            // score += 0.1; 

            return { block, score };
        });

        // Filter 0 scores if strict, or keep top anyway if fuzzy
        // We'll keep top K regardless to ensure context is filled

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(s => s.block);
    }
}
