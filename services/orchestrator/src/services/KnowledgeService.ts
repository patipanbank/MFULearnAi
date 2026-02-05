import axios from '../config/axios';
import FormData from 'form-data';
import { CanonicalIR } from '../../../../shared/types';
import { TokenService } from './TokenService';
import { LoggerService } from './LoggerService';

const KNOWLEDGE_URL = process.env.KNOWLEDGE_URL || 'http://localhost:7000/api/knowledge';

export class KnowledgeService {
    static async search(query: string, userContext: any, collectionId?: string, intent: string = 'QUERY'): Promise<string> {
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
                return response.data.results
                    .map((hit: any) => `[Source: ${hit.metadata.source}]\n${hit.content}`)
                    .join('\n\n');
            } else {
                LoggerService.warn('rag_search_no_results', { intent, query });
            }
        } catch (error: any) {
            console.warn('[KnowledgeService] Search failed:', error.message);
        }
        return '';
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
}
