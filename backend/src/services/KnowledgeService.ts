import mongoose from 'mongoose';
import { Knowledge, IKnowledge, Collection, ICollection } from '../knowledge/models';
import { minioClient, MINIO_BUCKET } from '../knowledge/minioClient';
import { knowledgeQueue } from '../knowledge/queue';
import { ChromaClient } from 'chromadb';
// import { AdapterFactory } from '../knowledge/adapters/AdapterFactory'; // Not needed if Controller handles parsing/upload?
import { CanonicalIR } from '../../../shared/types';
import { LoggerService } from './LoggerService'; // Internal Logger
import { Request, Response } from 'express';
import * as uuid from 'uuid';

const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
const chroma = new ChromaClient({ path: CHROMA_URL });
const GLOBAL_CHROMA_COLLECTION = "mfulearnai-global-kb";

interface UserContext {
    userId: string;
    role: string;
    department: string;
}

export class KnowledgeService {

    // --- Permissions ---
    static canCreateKnowledge(user: UserContext, type: string): boolean {
        if (type === 'personal') return true;
        if (type === 'department' && user.role === 'admin') return true;
        if (type === 'public' && user.role === 'admin') return true;
        if (type === 'policy' && user.role === 'admin') return true;
        return false;
    }

    static canManageKnowledge(user: UserContext, kb: IKnowledge): boolean {
        if (kb.type === 'personal') return kb.ownerId === user.userId;
        if (kb.type === 'department') return user.role === 'admin' && user.department === kb.department;
        if (kb.type === 'public') return user.role === 'admin' && user.department === kb.department;
        if (kb.type === 'policy') return user.role === 'admin'; // Any admin can manage policy? Or restricted? Assuming any admin for now as per request.
        return false;
    }

    static canReadKnowledge(user: UserContext, kb: IKnowledge): boolean {
        if (kb.type === 'public') return true;
        if (kb.type === 'policy') return true; // Policies are readable by everyone? Assuming yes for RAG.
        if (kb.type === 'department') return user.department === kb.department;
        if (kb.type === 'personal') return kb.ownerId === user.userId;
        return false;
    }

    static canManageCollection(user: UserContext, col: ICollection): boolean {
        if (col.type === 'default') return user.role === 'admin';
        if (col.type === 'department') return user.role === 'admin' && user.department === col.department;
        if (col.type === 'personal') return col.ownerId === user.userId;
        return false;
    }

    // --- Search ---
    static async search(
        query: string,
        userContext: any,
        options: {
            collectionId?: string;
            intent?: string;
            minScore?: number;
            metadataFilter?: any;
        } = {}
    ): Promise<{ text: string, sources: Array<{ id: string, name: string }>, blocks: CanonicalIR['blocks'], maxScore: number }> {
        const { collectionId, intent = 'QUERY', minScore = 0, metadataFilter } = options;
        try {
            const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION, embeddingFunction: null as any });

            // Get embedding (Internal Call)
            const { getEmbedding } = require('../knowledge/processingUtils');
            const queryEmbedding = await getEmbedding(query);

            const nResults = 10;
            const queryParams: any = {
                queryEmbeddings: [queryEmbedding],
                nResults: nResults,
            };

            // Apply Metadata Filter (Chroma 'where' clause)
            if (metadataFilter) {
                queryParams.where = metadataFilter;
            }

            const results = await col.query(queryParams);

            if (results.ids && results.ids.length > 0) {
                LoggerService.info('rag_search_internal_results', {
                    count: results.ids[0].length,
                    intent,
                    query
                });

                const ids = results.ids[0];
                const metadatas = results.metadatas[0];
                const documents = results.documents[0];
                const distances = results.distances?.[0]; // L2 Distances

                const uniqueKnowledgeIds = new Set(metadatas.map((m: any) => m.knowledgeId));
                const knowledgeDocs = await Knowledge.find({ _id: { $in: Array.from(uniqueKnowledgeIds) } });
                const knowledgeMap = new Map(knowledgeDocs.map(k => [k._id.toString(), k]));

                const validHits: any[] = [];
                const sourceMap = new Map<string, any>();

                for (let i = 0; i < ids.length; i++) {
                    const metadata = metadatas[i] as any;
                    const doc = documents[i];
                    if (!metadata) continue;

                    const kb = knowledgeMap.get(metadata.knowledgeId);
                    if (!kb) continue;

                    if (this.canReadKnowledge(userContext, kb)) {
                        // Collection Filter
                        if (collectionId) {
                            // TODO: Add robust collection filtering if needed
                        }

                        if (!sourceMap.has(kb._id.toString())) {
                            sourceMap.set(kb._id.toString(), {
                                id: kb._id.toString(),
                                name: kb.title,
                                canView: true
                            });
                        }

                        // Calculate Score: 1 / (1 + distance)
                        // Chroma L2 distance logic
                        const distance = distances ? distances[i] : 0;
                        const score = distances ? (1 / (1 + distance)) : 0;

                        if (score >= minScore) {
                            validHits.push({
                                id: ids[i],
                                content: doc,
                                metadata: metadata,
                                score: score
                            });
                        }
                    }
                }

                if (validHits.length === 0) {
                    return { text: '', sources: [], blocks: [], maxScore: 0 };
                }

                // Calculate Max Score
                const maxScore = Math.max(...validHits.map(h => h.score));

                const blocks = validHits.map((hit: any, index: number) => ({
                    id: hit.id || `search_b${index + 1}`,
                    content: hit.content,
                    type: 'text' as const,
                    metadata: {
                        fileId: hit.metadata.knowledgeId,
                        fileName: hit.metadata.source,
                        page: hit.metadata.pageNumber,
                        score: hit.score
                    }
                }));

                const text = validHits.map((hit: any, index: number) => {
                    const blockId = blocks[index].id;
                    return `<block id="${blockId}" score="${hit.score.toFixed(4)}">\n${hit.content}\n</block>`;
                }).join('\n\n');

                return {
                    text,
                    sources: Array.from(sourceMap.values()),
                    blocks,
                    maxScore
                };
            }

            return { text: '', sources: [], blocks: [], maxScore: 0 };
        } catch (error: any) {
            LoggerService.error('rag_search_internal_failed', { error: error.message });
            return { text: '', sources: [], blocks: [], maxScore: 0 };
        }
    }



    // --- Knowledge List ---
    static async getKnowledgeList(user: UserContext) {
        // Return personal + explicit department + public + policy(if admin)

        const conditions: any[] = [
            { type: 'public' },
            { type: 'department', department: user.department },
            { type: 'personal', ownerId: user.userId }
        ];

        if (user.role === 'admin') {
            conditions.push({ type: 'policy' });
        }

        const query: any = { $or: conditions };

        return await Knowledge.find(query).sort({ createdAt: -1 });
    }

    // --- Knowledge CRUD ---
    static async createKnowledgeRecord(
        user: UserContext,
        fileInfo: { originalName: string, mimeType: string, s3Key: string },
        fields: { type?: string }
    ) {
        const type = fields.type || 'personal';
        if (!this.canCreateKnowledge(user, type)) {
            throw new Error('Insufficient permissions');
        }

        const kbId = new mongoose.Types.ObjectId();
        // Since we already uploaded with a generated ID in controller?
        // Wait, Controller generated `kbId` for S3 key.
        // But Controller passes `s3Key`.
        // Controller used `kbId`. Does it pass it? 
        // Controller implementation: `const s3Key = .../kbId/...`. It doesn't pass kbId to this function explicitly, 
        // but this function generates a NEW kbId. THIS IS A BUG.
        // We must use the SAME ID if the S3 key depends on it.
        // Fix: Extract ID from s3Key or pass it.
        // Controller: `const s3Key = knowledge/${kbId}/...`
        // We can extract it or pass it. Let's extract from S3 Key or just generate a new one? 
        // If we generate new one, s3 key won't match.
        // Let's pass `id` in fileInfo or fields?

        // Actually, let's just parse it from S3 key if possible, or better, pass it.
        const idFromKey = fileInfo.s3Key.split('/')[1];
        const finalId = idFromKey || kbId.toString();

        const kb = new Knowledge({
            _id: finalId,
            title: fileInfo.originalName,
            type,
            contentSource: fileInfo.originalName,
            content: '',
            ownerId: user.userId,
            department: user.department,
            processingStatus: 'pending',
            processingStage: 'queued',
            s3Key: fileInfo.s3Key,
            contentType: fileInfo.mimeType,
        });
        await kb.save();

        await knowledgeQueue.add('process-file', {
            knowledgeId: kb._id.toString(),
            s3Key: fileInfo.s3Key,
            mimetype: fileInfo.mimeType,
            originalName: fileInfo.originalName
        });

        return kb;
    }

    static async retryProcessing(id: string, user: UserContext) {
        const kb = await Knowledge.findById(id);
        if (!kb) throw new Error('Not found');
        if (!this.canManageKnowledge(user, kb)) throw new Error('Permission denied');

        kb.processingStatus = 'pending';
        kb.processingStage = 'queued';
        kb.errorReason = '';
        await kb.save();

        await knowledgeQueue.add('process-file', {
            knowledgeId: kb._id.toString(),
            s3Key: kb.s3Key,
            mimetype: kb.contentType || 'application/pdf',
            originalName: kb.title
        });

        return kb;
    }

    static async deleteKnowledge(id: string, user: UserContext) {
        const kb = await Knowledge.findById(id);
        if (!kb) throw new Error('Not found');
        if (!this.canManageKnowledge(user, kb)) throw new Error('Permission denied');

        const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION, embeddingFunction: null as any });
        try {
            await col.delete({ where: { knowledgeId: kb._id.toString() } });
        } catch (e) { console.warn('Chroma delete failed', e); }

        await Knowledge.findByIdAndDelete(kb._id);
        await Collection.updateMany(
            { knowledgeIds: kb._id },
            { $pull: { knowledgeIds: kb._id } }
        );
        return kb._id;
    }

    // --- Publishing ---
    static async requestPublish(id: string, user: UserContext, targetType: string) {
        const kb = await Knowledge.findById(id);
        if (!kb) throw new Error('Not found');
        if (kb.ownerId !== user.userId) throw new Error('Only owner can request publish');
        if (kb.type !== 'personal') throw new Error('Only personal knowledge can be requested');

        kb.requestStatus = 'pending';
        if (targetType !== 'public' && targetType !== 'department') {
            throw new Error('Invalid target type');
        }
        kb.requestedType = targetType as 'public' | 'department';
        await kb.save();
        return kb;
    }

    static async approvePublish(id: string, user: UserContext, action: 'approve' | 'reject') {
        const kb = await Knowledge.findById(id);
        if (!kb) throw new Error('Not found');

        if (user.role !== 'admin') throw new Error('Admin only');
        if (user.department !== kb.department) throw new Error('Must be admin of owner department');

        if (action === 'approve') {
            if (kb.requestedType) {
                kb.type = kb.requestedType;
            }
            kb.requestStatus = 'approved';
        } else {
            kb.requestStatus = 'rejected';
        }
        await kb.save();
        return kb;
    }

    // --- Collections ---
    static async createCollection(user: UserContext, data: { name: string, description?: string, type: string }) {
        let allowed = false;
        if (data.type === 'personal') allowed = true;
        else if (data.type === 'department' && user.role === 'admin') allowed = true;

        if (!allowed) throw new Error('Not allowed to create this collection type');

        return await Collection.create({
            name: data.name,
            description: data.description,
            type: data.type,
            ownerId: user.userId,
            department: user.department,
            knowledgeIds: []
        });
    }

    static async updateCollection(id: string, user: UserContext, data: { name?: string, description?: string }) {
        const col = await Collection.findById(id);
        if (!col) throw new Error('Not found');
        if (!this.canManageCollection(user, col)) throw new Error('Permission denied');

        if (data.name) col.name = data.name;
        if (data.description !== undefined) col.description = data.description;
        await col.save();
        return col;
    }

    static async deleteCollection(id: string, user: UserContext) {
        const col = await Collection.findById(id);
        if (!col) throw new Error('Not found');
        if (!this.canManageCollection(user, col)) throw new Error('Permission denied');

        await Collection.findByIdAndDelete(id);
        return id;
    }

    static async mapKnowledgeToCollection(id: string, user: UserContext, knowledgeId: string, action: 'add' | 'remove') {
        const col = await Collection.findById(id);
        const kb = await Knowledge.findById(knowledgeId);

        if (!col || !kb) throw new Error('Not found');
        if (!this.canManageCollection(user, col)) throw new Error('Permission denied');
        if (!this.canReadKnowledge(user, kb)) throw new Error('Cannot access this knowledge');

        if (action === 'add') {
            const exists = col.knowledgeIds.some((existingId: any) => existingId.toString() === kb._id.toString());
            if (!exists) {
                col.knowledgeIds.push(kb._id as any);
            }
        } else if (action === 'remove') {
            col.knowledgeIds = col.knowledgeIds.filter((k: any) => k.toString() !== knowledgeId);
        }

        await col.save();
        return col;
    }

    static async getCollections(user: UserContext) {
        const query = {
            $or: [
                { type: 'default' },
                { type: 'department', department: user.department },
                { type: 'personal', ownerId: user.userId }
            ]
        };
        return await Collection.find(query).sort({ type: 1, createdAt: -1 });
    }

    static async getCollectionDetails(id: string, user: UserContext) {
        const col = await Collection.findById(id).populate('knowledgeIds');
        if (!col) throw new Error('Not found');

        let canView = false;
        if (col.type === 'default') canView = true;
        else if (col.type === 'department' && col.department === user.department) canView = true;
        else if (col.type === 'personal' && col.ownerId === user.userId) canView = true;

        if (!canView) throw new Error('Access denied');
        return col;
    }

    // --- Stream View ---
    static async getFileStream(id: string, user: UserContext) {
        const kb = await Knowledge.findById(id);
        if (!kb) throw new Error('Not found');
        if (!this.canReadKnowledge(user, kb)) throw new Error('Permission denied');

        const stream = await minioClient.getObject(MINIO_BUCKET, kb.s3Key || '');
        return { stream, headers: { 'content-type': kb.contentType, 'content-disposition': `inline; filename="${kb.title}"` } };
    }

    // --- Phase 2: Local RAG (Helper) ---
    static assignBlockIds(fileParses: CanonicalIR[]): CanonicalIR[] {
        return fileParses.map((ir, fileIdx) => ({
            ...ir,
            blocks: ir.blocks.map((block, blockIdx) => ({
                ...block,
                id: `f${fileIdx + 1}_b${blockIdx + 1}`
            }))
        }));
    }

    static async searchLocal(query: string, fileParses: CanonicalIR[], limit: number = 15): Promise<CanonicalIR['blocks']> {
        // ... (Same heuristic logic as before)
        const allBlocks = fileParses.flatMap(f => f.blocks.map(b => ({
            ...b,
            metadata: {
                ...b.metadata,
                fileName: b.metadata.fileName || f.metadata?.detected_language || 'file',
                fileId: b.metadata.fileId
            }
        })));
        if (allBlocks.length === 0) return [];

        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);
        const scored = allBlocks.map(block => {
            let score = 0;
            const content = block.content.toLowerCase();
            if (content.includes(query.toLowerCase())) score += 10;
            terms.forEach(term => {
                if (content.includes(term)) score += 3;
            });
            return { block, score };
        });

        return scored
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(s => s.block);
    }
}
