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
import { KnowledgeHit } from '../models/KnowledgeHit';

const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
const chroma = new ChromaClient({ path: CHROMA_URL });
const GLOBAL_CHROMA_COLLECTION = "mfulearnai-global-kb";

interface UserContext {
    userId: string;
    role: string;
    department: string;
}

export class KnowledgeService {

    // --- Helpers ---
    static isAdmin(user: UserContext): boolean {
        return user.role === 'admin' || user.role === 'superadmin';
    }

    // --- Permissions ---
    static canCreateKnowledge(user: UserContext, type: string): boolean {
        if (user.role === 'superadmin') return true; // Superadmin can create any type
        if (type === 'personal') return true;
        if (type === 'department' && user.role === 'admin') return true;
        if (type === 'public' && user.role === 'admin') return true;
        if (type === 'policy' && user.role === 'admin') return true;
        return false;
    }

    static canManageKnowledge(user: UserContext, kb: IKnowledge): boolean {
        if (user.role === 'superadmin') return true; // Superadmin can manage any knowledge regardless of owner
        if (kb.type === 'personal') return kb.ownerId === user.userId;
        if (kb.type === 'department') return user.role === 'admin' && user.department === kb.department;
        if (kb.type === 'public') return user.role === 'admin' && user.department === kb.department;
        if (kb.type === 'policy') return user.role === 'admin';
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
        if (user.role === 'superadmin') return true; // Superadmin can manage any collection
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
                        const distVal = distances?.[i];
                        const isValidDistance = typeof distVal === 'number';
                        const distance = isValidDistance ? (distVal as number) : 0;
                        const score = isValidDistance ? (1 / (1 + distance)) : 0;

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

                const result = {
                    text,
                    sources: Array.from(sourceMap.values()),
                    blocks,
                    maxScore
                };

                // Fire-and-forget: log hits for usage analytics
                const userId = userContext?.userId || 'unknown';
                const hitDocs = Array.from(sourceMap.keys());
                if (hitDocs.length > 0) {
                    Promise.all(
                        hitDocs.map(knowledgeId => {
                            const bestHit = validHits.find(h => h.metadata?.knowledgeId === knowledgeId);
                            return KnowledgeHit.create({
                                knowledgeId,
                                query,
                                score: bestHit?.score ?? 0,
                                userId,
                                toolName: options.metadataFilter?.type === 'policy' ? 'check_policy' : 'search'
                            });
                        })
                    ).catch(err => LoggerService.warn('knowledge_hit_log_failed', { error: err.message }));
                }

                return result;
            }

            return { text: '', sources: [], blocks: [], maxScore: 0 };
        } catch (error: any) {
            LoggerService.error('rag_search_internal_failed', { error: error.message });
            return { text: '', sources: [], blocks: [], maxScore: 0 };
        }
    }



    // --- Knowledge List ---
    // Supports optional filters: { type?, requestStatus? }
    static async getKnowledgeList(user: UserContext, filters: { type?: string; requestStatus?: string } = {}) {
        const { type, requestStatus } = filters;

        // --- Special case: requestStatus filter (used by Manage Requests modal) ---
        if (requestStatus) {
            const statusFilter: any = { requestStatus };

            if (user.role === 'superadmin') {
                // Superadmin sees all items with this requestStatus
                return await Knowledge.find(statusFilter).sort({ createdAt: -1 });
            }

            if (this.isAdmin(user)) {
                // Admin sees pending requests from their department
                return await Knowledge.find({
                    ...statusFilter,
                    department: user.department
                }).sort({ createdAt: -1 });
            }

            // Non-admin: see only their own pending requests
            return await Knowledge.find({
                ...statusFilter,
                ownerId: user.userId
            }).sort({ createdAt: -1 });
        }

        // --- Standard list (with optional type filter) ---

        // Superadmin sees ALL knowledge across all departments
        if (user.role === 'superadmin') {
            const query: any = {};
            if (type) query.type = type;
            return await Knowledge.find(query).sort({ createdAt: -1 });
        }

        // Build permission-based conditions
        const conditions: any[] = [
            { type: 'public' },
            { type: 'department', department: user.department },
            { type: 'personal', ownerId: user.userId }
        ];

        if (this.isAdmin(user)) {
            conditions.push({ type: 'policy' });
        }

        const query: any = { $or: conditions };

        // Apply type filter: narrow down the $or conditions to only the matching type
        if (type) {
            query.type = type;
            // Remove conflicting $or — instead apply direct permission check for the requested type
            delete query.$or;

            // Validate the user can see this type
            if (type === 'personal') {
                query.ownerId = user.userId;
            } else if (type === 'department') {
                query.department = user.department;
            } else if (type === 'policy' && !this.isAdmin(user)) {
                return []; // Non-admin cannot filter by policy type
            }
            // 'public' needs no additional filter
        }

        return await Knowledge.find(query).sort({ createdAt: -1 });
    }

    // --- Knowledge CRUD ---
    /**
     * Update editable fields on a knowledge item (description, tags).
     * Only the owner, relevant admin, or superadmin can update.
     */
    static async updateKnowledge(
        id: string,
        user: UserContext,
        updates: { description?: string; tags?: string[]; folder?: string; expiresAt?: string }
    ) {
        const kb = await Knowledge.findById(id);
        if (!kb) throw new Error('Not found');
        if (!this.canManageKnowledge(user, kb)) throw new Error('Permission denied');

        // Validate tags
        if (updates.tags !== undefined) {
            if (!Array.isArray(updates.tags)) throw new Error('tags must be an array');
            if (updates.tags.length > 20) throw new Error('Maximum 20 tags allowed');
            // Sanitize: trim, lowercase, remove duplicates, limit length
            updates.tags = [...new Set(
                updates.tags
                    .map(t => t.trim().toLowerCase().slice(0, 50))
                    .filter(t => t.length > 0)
            )];
        }

        if (updates.description !== undefined) {
            kb.description = updates.description.slice(0, 2000);
        }
        if (updates.tags !== undefined) {
            kb.tags = updates.tags;
        }
        if (updates.folder !== undefined) {
            kb.folder = updates.folder.trim();
        }
        if (updates.expiresAt !== undefined) {
            kb.expiresAt = updates.expiresAt ? new Date(updates.expiresAt) : undefined;
        }

        await kb.save();
        return kb;
    }

    static async createKnowledgeRecord(
        user: UserContext,
        fileInfo: { originalName: string, mimeType: string, s3Key: string },
        fields: { type?: string, folder?: string, expiresAt?: string }
    ) {
        const type = fields.type || 'personal';
        if (!this.canCreateKnowledge(user, type)) {
            throw new Error('Insufficient permissions');
        }

        // Fix: Extract existing ID from S3 key (format: knowledge/<ID>/filename)
        // The Controller generated this ID for the S3 path, so we MUST use it for the record ID
        // to ensure the Worker can find the record later.
        const pathParts = fileInfo.s3Key.split('/');
        let finalId = '';
        if (pathParts.length >= 2 && mongoose.Types.ObjectId.isValid(pathParts[1])) {
            finalId = pathParts[1];
        } else {
            // Fallback (should not happen if Controller logic is correct)
            finalId = new mongoose.Types.ObjectId().toString();
            LoggerService.warn('knowledge_id_mismatch', { s3Key: fileInfo.s3Key, generatedId: finalId }, user.userId);
        }

        // --- Versioning Logic ---
        let version = 1;
        let previousVersionId = undefined;

        // Look for an existing active document with the same title
        const existingDoc = await Knowledge.findOne({
            title: fileInfo.originalName,
            type: type,
            ownerId: user.userId,
            department: user.department,
            visibility: 'active'
        });

        if (existingDoc) {
            version = (existingDoc.version || 1) + 1;
            previousVersionId = existingDoc._id;

            // Archive the old version so it doesn't show up in search/lists
            existingDoc.visibility = 'archived';
            await existingDoc.save();
            console.log(`[Knowledge] Versioning: Archived ${existingDoc._id} (v${existingDoc.version}). Creating v${version}`);
        }

        const expiresAtDate = fields.expiresAt ? new Date(fields.expiresAt) : undefined;

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
            version,
            previousVersionId,
            folder: fields.folder || '',
            expiresAt: expiresAtDate
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

    static async createFromUrl(user: UserContext, url: string, typeVal?: string, fields?: { folder?: string, expiresAt?: string }) {
        const type = typeVal || 'personal';
        if (!this.canCreateKnowledge(user, type)) {
            throw new Error('Insufficient permissions');
        }

        // Extract host/path for default title
        let title = url;
        try {
            const u = new URL(url);
            title = `Web: ${u.hostname}${u.pathname}`.substring(0, 100);
        } catch (e) { /* fallback to full URL */ }

        const kbId = new mongoose.Types.ObjectId().toString();

        const expiresAtDate = fields?.expiresAt ? new Date(fields.expiresAt) : undefined;

        const kb = new Knowledge({
            _id: kbId,
            title,
            type,
            contentSource: url,
            content: '',
            ownerId: user.userId,
            department: user.department,
            processingStatus: 'pending',
            processingStage: 'queued',
            contentType: 'text/html', // pseudo-mime for scraped content
            version: 1,
            folder: fields?.folder || '',
            expiresAt: expiresAtDate
        });
        await kb.save();

        await knowledgeQueue.add('process-url', {
            knowledgeId: kbId,
            url
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

        if (!this.isAdmin(user)) throw new Error('Admin only');
        // Superadmin can approve cross-department; admin must match department
        if (user.role !== 'superadmin' && user.department !== kb.department) {
            throw new Error('Must be admin of owner department');
        }

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
        if (user.role === 'superadmin') allowed = true; // Superadmin can create any collection type
        else if (data.type === 'personal') allowed = true;
        else if (data.type === 'department' && this.isAdmin(user)) allowed = true;

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
        // Superadmin sees all collections
        if (user.role === 'superadmin') {
            return await Collection.find({}).sort({ type: 1, createdAt: -1 });
        }

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
        if (user.role === 'superadmin') canView = true; // Superadmin sees all
        else if (col.type === 'default') canView = true;
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

    // --- Analytics ---

    /**
     * System-wide knowledge usage stats (admin dashboard).
     * Returns: top used docs, never-used docs, 7-day trend, totals.
     */
    static async getStats(user: UserContext) {
        if (!this.isAdmin(user)) throw new Error('Admin only');

        const { MessageFeedback } = await import('../models/MessageFeedback');
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Top 10 most-used documents (by hit count)
        const topDocs = await KnowledgeHit.aggregate([
            {
                $group: {
                    _id: '$knowledgeId',
                    hitCount: { $sum: 1 },
                    avgScore: { $avg: '$score' },
                    lastAccessed: { $max: '$createdAt' },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            },
            { $sort: { hitCount: -1 } },
            { $limit: 10 },
            {
                $project: {
                    _id: 1,
                    hitCount: 1,
                    avgScore: { $round: ['$avgScore', 3] },
                    lastAccessed: 1,
                    uniqueUserCount: { $size: '$uniqueUsers' }
                }
            }
        ]);

        // Enrich with knowledge titles
        const docIds = topDocs.map(d => d._id);
        const knowledgeDocs = await Knowledge.find(
            { _id: { $in: docIds } },
            { title: 1, type: 1, department: 1, tags: 1 }
        );
        const kbMap = new Map(knowledgeDocs.map(k => [k._id.toString(), k]));

        const enrichedTopDocs = topDocs.map(d => ({
            ...d,
            title: kbMap.get(d._id)?.title || 'Unknown',
            type: kbMap.get(d._id)?.type || 'unknown',
            department: kbMap.get(d._id)?.department || '',
            tags: kbMap.get(d._id)?.tags || []
        }));

        // Never-used documents (no hits at all)
        const usedIds = await KnowledgeHit.distinct('knowledgeId');
        const neverUsedQuery: any = {
            _id: { $nin: usedIds.map(id => id) },
            processingStatus: 'completed'
        };
        // Scope to user's department for non-superadmin
        if (user.role !== 'superadmin') {
            neverUsedQuery.department = user.department;
        }
        const neverUsed = await Knowledge.find(neverUsedQuery, {
            title: 1, type: 1, department: 1, createdAt: 1
        }).sort({ createdAt: -1 }).limit(20);

        // 7-day hit trend
        const dailyTrend = await KnowledgeHit.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Feedback summary
        const feedbackSummary = await MessageFeedback.aggregate([
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);
        const feedbackMap = Object.fromEntries(feedbackSummary.map(f => [f._id, f.count]));

        // Total counts
        const totalKnowledge = await Knowledge.countDocuments({ visibility: 'active' });
        const totalHits = await KnowledgeHit.countDocuments();

        return {
            topDocs: enrichedTopDocs,
            neverUsed,
            dailyTrend,
            feedback: {
                liked: feedbackMap['liked'] || 0,
                disliked: feedbackMap['disliked'] || 0
            },
            totals: {
                knowledge: totalKnowledge,
                hits: totalHits,
                neverUsedCount: neverUsed.length
            }
        };
    }

    /**
     * Per-document usage analytics (detail modal).
     * Returns: hit count, unique users, top queries, feedback.
     */
    static async getDocumentAnalytics(id: string, user: UserContext) {
        const kb = await Knowledge.findById(id);
        if (!kb) throw new Error('Not found');
        if (!this.canReadKnowledge(user, kb)) throw new Error('Permission denied');

        const { MessageFeedback } = await import('../models/MessageFeedback');

        // Hit stats
        const hitStats = await KnowledgeHit.aggregate([
            { $match: { knowledgeId: id } },
            {
                $group: {
                    _id: null,
                    totalHits: { $sum: 1 },
                    avgScore: { $avg: '$score' },
                    lastAccessed: { $max: '$createdAt' },
                    uniqueUsers: { $addToSet: '$userId' }
                }
            }
        ]);

        const stats = hitStats[0] || {
            totalHits: 0, avgScore: 0, lastAccessed: null, uniqueUsers: []
        };

        // Top queries that retrieved this document
        const topQueries = await KnowledgeHit.aggregate([
            { $match: { knowledgeId: id } },
            {
                $group: {
                    _id: '$query',
                    count: { $sum: 1 },
                    avgScore: { $avg: '$score' }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 },
            {
                $project: {
                    query: '$_id',
                    count: 1,
                    avgScore: { $round: ['$avgScore', 3] },
                    _id: 0
                }
            }
        ]);

        // Daily hits (last 30 days)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const dailyHits = await KnowledgeHit.aggregate([
            { $match: { knowledgeId: id, createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Feedback for messages that used this document
        const feedbackStats = await MessageFeedback.aggregate([
            { $match: { knowledgeIds: id } },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);
        const feedbackMap = Object.fromEntries(feedbackStats.map(f => [f._id, f.count]));
        const liked = feedbackMap['liked'] || 0;
        const disliked = feedbackMap['disliked'] || 0;

        // --- Phase 4: Knowledge Quality Score (#13) ---
        // 1. Feedback (0-50 pts)
        let feedbackScore = 25; // default baseline for no feedback
        if (liked + disliked > 0) {
            feedbackScore = (liked / (liked + disliked)) * 50;
        }

        // 2. Hits (0-30 pts)
        const hits = stats.totalHits || 0;
        const hitScore = Math.min(30, (hits / 50) * 30); // Maxes out at 50 hits

        // 3. Recency (0-20 pts)
        const daysOld = (Date.now() - kb.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        let ageScore = 5;
        if (daysOld <= 30) ageScore = 20;
        else if (daysOld <= 90) ageScore = 15;
        else if (daysOld <= 180) ageScore = 10;

        const qualityScore = Math.round(feedbackScore + hitScore + ageScore);
        // ----------------------------------------------

        return {
            totalHits: stats.totalHits,
            avgScore: Math.round((stats.avgScore || 0) * 1000) / 1000,
            lastAccessed: stats.lastAccessed,
            uniqueUsers: stats.uniqueUsers?.length || 0,
            topQueries,
            dailyHits,
            qualityScore,
            feedback: {
                liked,
                disliked
            }
        };
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
