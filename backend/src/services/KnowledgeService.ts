import mongoose from 'mongoose';
import { Knowledge, IKnowledge, Collection, ICollection } from '../knowledge/models';
import { minioClient, MINIO_BUCKET } from '../knowledge/minioClient';
import { knowledgeQueue } from '../knowledge/queue';
import { ChromaClient } from 'chromadb';
import { CanonicalIR } from '../../../shared/types';
import { LoggerService } from './LoggerService';
import { KnowledgeHit } from '../models/KnowledgeHit';
import { getEmbedding } from '../knowledge/processingUtils';
import { CHROMA_URL, GLOBAL_CHROMA_COLLECTION } from '../knowledge/constants';
import { UserContext } from '../knowledge/types';
import User from '../models/User';
import { RerankService, RerankHit } from './RerankService';

const chroma = new ChromaClient({ path: CHROMA_URL });

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
        // Superadmin can read any knowledge
        if (user.role === 'superadmin') return true;
        // Admin can read all knowledge in their department + public + policy
        if (user.role === 'admin') {
            if (kb.type === 'public' || kb.type === 'policy') return true;
            if (kb.type === 'department' && user.department === kb.department) return true;
            if (kb.type === 'personal' && user.department === kb.department) return true;
            if (kb.type === 'personal' && kb.ownerId === user.userId) return true;
            return false;
        }

        if (kb.type === 'public') return true;
        if (kb.type === 'policy') return true; // Policies are readable by everyone? Assuming yes for RAG.

        // API Key KB access override: check allowedDepartments and allowedKnowledgeIds
        if ((user as any).allowedDepartments || (user as any).allowedKnowledgeIds) {
            const allowedDepts: string[] = (user as any).allowedDepartments || [];
            const allowedKbIds: string[] = (user as any).allowedKnowledgeIds || [];

            // Check allowedKnowledgeIds first (explicit access)
            if (allowedKbIds.length > 0 && allowedKbIds.includes(kb._id?.toString())) {
                return true;
            }

            // Check allowedDepartments
            if (allowedDepts.includes('*')) {
                // Wildcard: all departments accessible
                if (kb.type === 'department') return true;
            } else if (allowedDepts.length > 0) {
                if (kb.type === 'department' && allowedDepts.includes(kb.department)) return true;
            }

            // If no department wildcard and no explicit KB ID match, fall through to default
            if (allowedDepts.length > 0 || allowedKbIds.length > 0) {
                // API Key has restrictions defined — use default department check as fallback
                if (kb.type === 'department') return user.department === kb.department;
                if (kb.type === 'personal') return kb.ownerId === user.userId;
                return false;
            }
        }

        if (kb.type === 'department') return user.department === kb.department;
        if (kb.type === 'personal') return kb.ownerId === user.userId;
        return false;
    }

    static canManageCollection(user: UserContext, col: ICollection): boolean {
        if (user.role === 'superadmin') return true; // Superadmin can manage any collection
        if (col.type === 'default') return user.role === 'admin';
        if (col.type === 'department') return user.role === 'admin' && user.department === col.department;
        if (col.type === 'personal') {
            // Owner can always manage their own personal collection
            if (col.ownerId === user.userId) return true;
            // Admin can manage personal collections within their department (e.g. to promote type)
            if (user.role === 'admin' && user.department === col.department) return true;
            return false;
        }
        return false;
    }

    /**
     * Enrich knowledge items with ownerName from User collection.
     * Batches all unique ownerIds into a single DB query for efficiency.
     */
    private static async enrichWithOwnerNames(items: any[]): Promise<any[]> {
        if (!items.length) return items;
        const ownerIds = [...new Set(items.map(i => i.ownerId).filter(Boolean))];
        if (!ownerIds.length) return items;

        try {
            // ownerId is stored as string (_id.toString()), query by _id
            const objectIds = ownerIds
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));
            const users = await User.find({ _id: { $in: objectIds } })
                .select('_id firstName lastName username')
                .lean();
            const nameMap = new Map<string, string>();
            for (const u of users) {
                const name = u.firstName
                    ? `${u.firstName} ${u.lastName || ''}`.trim()
                    : u.username;
                nameMap.set(u._id.toString(), name);
            }

            return items.map(item => {
                const doc = typeof item.toObject === 'function' ? item.toObject() : { ...item };
                doc.ownerName = nameMap.get(doc.ownerId) || undefined;
                return doc;
            });
        } catch (err: any) {
            LoggerService.warn('enrich_owner_names_failed', { error: err.message });
            return items; // Graceful fallback — return items without names
        }
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
            topK?: number;
            allowedKnowledgeIds?: Set<string>;
            /** Set to false to skip reranking for this call */
            skipRerank?: boolean;
        } = {}
    ): Promise<{ text: string, sources: Array<{ id: string, name: string }>, blocks: CanonicalIR['blocks'], maxScore: number }> {
        const { collectionId, intent = 'QUERY', minScore = 0, metadataFilter } = options;
        try {
            const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION, embeddingFunction: null as any });

            // Get embedding (top-level import)
            const queryEmbedding = await getEmbedding(query);

            // Stage 1: Retrieve broad (20 candidates for reranker to narrow down)
            const nResults = 20;
            const queryParams: any = {
                queryEmbeddings: [queryEmbedding],
                nResults: nResults,
            };

            // Apply Metadata Filter (Chroma 'where' clause)
            if (metadataFilter) {
                queryParams.where = metadataFilter;
            }

            // Pre-calculate allowed Knowledge IDs if searching within a specific collection
            // This natively injects 'default' collection results (e.g. System Policies) into the search scope
            const allowedKnowledgeIds = new Set<string>();
            if (options.collectionId) {
                const targetCol = await Collection.findById(options.collectionId);
                if (targetCol) {
                    targetCol.knowledgeIds.forEach((kid: any) => allowedKnowledgeIds.add(kid.toString()));
                }

                // Inject Default Collections
                const defaultCols = await Collection.find({ type: 'default' });
                defaultCols.forEach(col => {
                    col.knowledgeIds.forEach((kid: any) => allowedKnowledgeIds.add(kid.toString()));
                });
            }
            options.allowedKnowledgeIds = allowedKnowledgeIds;

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
                const distances = results.distances?.[0]; // Cosine Distances (range 0–2)

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
                        // Collection Filter: skip documents not in the requested collection OR default collections
                        if (collectionId) {
                            if (!options.allowedKnowledgeIds?.has(kb._id.toString())) {
                                continue; // Not in target collection and not a default policy
                            }
                        }

                        if (!sourceMap.has(kb._id.toString())) {
                            sourceMap.set(kb._id.toString(), {
                                id: kb._id.toString(),
                                name: kb.title,
                                canView: true
                            });
                        }

                        // Calculate Score from Cosine Distance
                        // ChromaDB cosine distance = 1 - cos(a,b), range [0, 2]
                        // Convert to similarity score [0, 1]: score = 1 - (distance / 2)
                        const distVal = distances?.[i];
                        const isValidDistance = typeof distVal === 'number';
                        const distance = isValidDistance ? (distVal as number) : 2;
                        const score = isValidDistance ? Math.max(0, 1 - (distance / 2)) : 0;

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

                // ── Stage 2: Rerank with Cohere cross-encoder ──────────────
                // Re-scores and re-orders hits by query-document relevance.
                // Falls back to cosine scores on error (configurable).
                let finalHits: any[];
                if (options.skipRerank) {
                    finalHits = validHits.map(h => ({ ...h, rerankScore: h.score }));
                } else {
                    const rerankInput: RerankHit[] = validHits.map(h => ({
                        id: h.id,
                        content: h.content,
                        metadata: h.metadata,
                        score: h.score,
                    }));
                    finalHits = await RerankService.rerank(query, rerankInput);
                }

                // Rebuild sourceMap from reranked hits (subset may have changed)
                sourceMap.clear();
                for (const hit of finalHits) {
                    const kb = knowledgeMap.get(hit.metadata.knowledgeId);
                    if (kb && !sourceMap.has(kb._id.toString())) {
                        sourceMap.set(kb._id.toString(), {
                            id: kb._id.toString(),
                            name: kb.title,
                            canView: true
                        });
                    }
                }

                // Calculate Max Score (use rerankScore from cross-encoder)
                const maxScore = Math.max(...finalHits.map((h: any) => h.rerankScore));

                const blocks = finalHits.map((hit: any, index: number) => ({
                    id: hit.id || `search_b${index + 1}`,
                    content: hit.content,
                    type: 'text' as const,
                    metadata: {
                        fileId: hit.metadata.knowledgeId,
                        fileName: hit.metadata.source,
                        page: hit.metadata.pageNumber,
                        score: hit.rerankScore,
                        cosineScore: hit.score,
                    }
                }));

                const MAX_BLOCK_CHARS = 800; // Cap per-block content to save tokens
                const text = finalHits.map((hit: any, index: number) => {
                    const blockId = blocks[index].id;
                    const content = hit.content.length > MAX_BLOCK_CHARS
                        ? hit.content.substring(0, MAX_BLOCK_CHARS) + '…'
                        : hit.content;
                    return `<block id="${blockId}" score="${hit.rerankScore.toFixed(4)}">\n${content}\n</block>`;
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
                            const bestHit = finalHits.find((h: any) => h.metadata?.knowledgeId === knowledgeId);
                            return KnowledgeHit.create({
                                knowledgeId,
                                query,
                                score: bestHit?.rerankScore ?? bestHit?.score ?? 0,
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
    // Supports optional filters: { type?, requestStatus?, page?, limit? }
    static async getKnowledgeList(user: UserContext, filters: { type?: string; requestStatus?: string; page?: number; limit?: number } = {}) {
        const { type, requestStatus } = filters;
        const page = Math.max(1, filters.page || 1);
        const limit = Math.min(200, Math.max(1, filters.limit || 50));
        const skip = (page - 1) * limit;

        // Enterprise: Always filter out archived/deleted documents
        const visibilityFilter = { visibility: { $nin: ['archived', 'deleted'] } };

        let resultQuery: any;
        let total: number;

        // --- Special case: requestStatus filter (used by Manage Requests modal) ---
        if (requestStatus) {
            const statusFilter: any = { requestStatus, ...visibilityFilter };

            if (user.role === 'superadmin') {
                resultQuery = statusFilter;
            } else if (this.isAdmin(user)) {
                resultQuery = { ...statusFilter, department: user.department };
            } else {
                resultQuery = { ...statusFilter, ownerId: user.userId };
            }

            total = await Knowledge.countDocuments(resultQuery);
            const items = await Knowledge.find(resultQuery).sort({ createdAt: -1 }).skip(skip).limit(limit);
            const enriched = await this.enrichWithOwnerNames(items);
            return { items: enriched, total, page, limit };
        }

        // --- Standard list (with optional type filter) ---

        if (user.role === 'superadmin') {
            resultQuery = { ...visibilityFilter };
            if (type) resultQuery.type = type;
        } else {
            const conditions: any[] = [
                { type: 'public' },
                { type: 'department', department: user.department },
                { type: 'personal', ownerId: user.userId }
            ];

            if (this.isAdmin(user)) {
                conditions.push({ type: 'policy' });
            }

            resultQuery = { $or: conditions, ...visibilityFilter };

            if (type) {
                resultQuery = { type, ...visibilityFilter };
                if (type === 'personal') {
                    resultQuery.ownerId = user.userId;
                } else if (type === 'department') {
                    resultQuery.department = user.department;
                } else if (type === 'policy' && !this.isAdmin(user)) {
                    return { items: [], total: 0, page, limit };
                }
            }
        }

        total = await Knowledge.countDocuments(resultQuery);
        const items = await Knowledge.find(resultQuery).sort({ createdAt: -1 }).skip(skip).limit(limit);
        const enriched = await this.enrichWithOwnerNames(items);
        return { items: enriched, total, page, limit };
    }

    // --- Knowledge CRUD ---
    /**
     * Update editable fields on a knowledge item (description, tags).
     * Only the owner, relevant admin, or superadmin can update.
     */
    static async updateKnowledge(
        id: string,
        user: UserContext,
        updates: { title?: string; description?: string; tags?: string[]; folder?: string; expiresAt?: string }
    ) {
        const kb = await Knowledge.findById(id);
        if (!kb) throw new Error('Not found');
        if (!this.canManageKnowledge(user, kb)) throw new Error('Permission denied');

        // Validate title
        if (updates.title !== undefined) {
            const title = updates.title.trim();
            if (!title) throw new Error('Title cannot be empty');
            if (title.length > 200) throw new Error('Title too long (max 200 characters)');
            kb.title = title;
        }

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
        fields: { type?: string, folder?: string, expiresAt?: string },
        predefinedKbId?: mongoose.Types.ObjectId,
        auditData?: { uploadIp?: string, originalFileHash?: string, detectedMimeType?: string }
    ) {
        const type = fields.type || 'personal';
        if (!this.canCreateKnowledge(user, type)) {
            throw new Error('Insufficient permissions');
        }

        let finalId = predefinedKbId?.toString() || '';

        if (!finalId) {
            const pathParts = fileInfo.s3Key.split('/');
            if (pathParts.length >= 2 && mongoose.Types.ObjectId.isValid(pathParts[1])) {
                finalId = pathParts[1];
            } else {
                finalId = new mongoose.Types.ObjectId().toString();
                LoggerService.warn('knowledge_id_mismatch', { s3Key: fileInfo.s3Key, generatedId: finalId }, user.userId);
            }
        }

        // --- Versioning Logic ---
        let version = 1;
        let previousVersionId = undefined;

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

            existingDoc.visibility = 'archived';
            await existingDoc.save();
            LoggerService.info('knowledge_versioning', { archivedId: existingDoc._id, oldVersion: existingDoc.version, newVersion: version });
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
            expiresAt: expiresAtDate,
            // Enterprise: Audit trail
            lastModifiedBy: user.userId,
            uploadIp: auditData?.uploadIp,
            originalFileHash: auditData?.originalFileHash,
            detectedMimeType: auditData?.detectedMimeType,
            processingRetryCount: 0
        });
        await kb.save();

        await knowledgeQueue.add('process-file', {
            knowledgeId: kb._id.toString(),
            s3Key: fileInfo.s3Key,
            mimetype: fileInfo.mimeType,
            originalName: fileInfo.originalName
        }, {
            jobId: `file-${kb._id.toString()}`, // Dedup: BullMQ rejects duplicate jobId while job exists
        });

        return kb;
    }

    static async createFromUrl(user: UserContext, url: string, typeVal?: string, fields?: { folder?: string, expiresAt?: string }, auditData?: { uploadIp?: string }) {
        const type = typeVal || 'personal';
        if (!this.canCreateKnowledge(user, type)) {
            throw new Error('Insufficient permissions');
        }

        let title = url;
        try {
            const sheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
            const docsMatch = url.match(/docs\.google\.com\/document\/d\/([\w-]+)/);
            const slidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([\w-]+)/);
            if (sheetsMatch) {
                title = `Google Sheets: ${sheetsMatch[1]}`.substring(0, 100);
            } else if (docsMatch) {
                title = `Google Docs: ${docsMatch[1]}`.substring(0, 100);
            } else if (slidesMatch) {
                title = `Google Slides: ${slidesMatch[1]}`.substring(0, 100);
            } else {
                const u = new URL(url);
                title = `Web: ${u.hostname}${u.pathname}`.substring(0, 100);
            }
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
            contentType: 'text/html',
            version: 1,
            folder: fields?.folder || '',
            expiresAt: expiresAtDate,
            // Enterprise: Audit trail
            lastModifiedBy: user.userId,
            uploadIp: auditData?.uploadIp,
            processingRetryCount: 0
        });
        await kb.save();

        await knowledgeQueue.add('process-url', {
            knowledgeId: kbId,
            url
        }, {
            jobId: `url-${kbId}`, // Dedup: BullMQ rejects duplicate jobId while job exists
        });

        return kb;
    }

    static async retryProcessing(id: string, user: UserContext) {
        const kb = await Knowledge.findById(id);
        if (!kb) throw new Error('Not found');
        if (!this.canManageKnowledge(user, kb)) throw new Error('Permission denied');

        // Idempotency: Only allow retry from terminal states
        if (kb.processingStatus === 'pending' || kb.processingStatus === 'processing') {
            LoggerService.warn('knowledge_retry_skipped_already_active', {
                knowledgeId: id,
                currentStatus: kb.processingStatus,
                userId: user.userId
            });
            return kb; // Already queued/processing — no-op
        }

        kb.processingStatus = 'pending';
        kb.processingStage = 'queued';
        kb.errorReason = '';
        await kb.save();

        // Stable jobId prevents double-click duplicates, but BullMQ keeps completed/failed
        // jobs for days (removeOnComplete.age). We must evict the old retry job first,
        // otherwise queue.add() silently no-ops and the doc stays stuck at "pending".
        if (kb.contentSource && !kb.s3Key) {
            const retryJobId = `url-${kb._id.toString()}-retry`;
            const oldJob = await knowledgeQueue.getJob(retryJobId);
            if (oldJob) {
                try { await oldJob.remove(); } catch (_) { /* may already be active */ }
            }
            await knowledgeQueue.add('process-url', {
                knowledgeId: kb._id.toString(),
                url: kb.contentSource
            }, {
                jobId: retryJobId,
            });
        } else {
            const retryJobId = `file-${kb._id.toString()}-retry`;
            const oldJob = await knowledgeQueue.getJob(retryJobId);
            if (oldJob) {
                try { await oldJob.remove(); } catch (_) { /* may already be active */ }
            }
            await knowledgeQueue.add('process-file', {
                knowledgeId: kb._id.toString(),
                s3Key: kb.s3Key,
                mimetype: kb.contentType || 'application/pdf',
                originalName: kb.title
            }, {
                jobId: retryJobId,
            });
        }

        return kb;
    }

    static async deleteKnowledge(id: string, user: UserContext) {
        const kb = await Knowledge.findById(id);
        if (!kb) throw new Error('Not found');
        if (!this.canManageKnowledge(user, kb)) throw new Error('Permission denied');

        // CQ-6: ChromaDB cleanup with retry and proper logging
        const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION, embeddingFunction: null as any });
        try {
            await col.delete({ where: { knowledgeId: kb._id.toString() } });
        } catch (e: any) {
            LoggerService.error('knowledge_chroma_delete_failed', {
                knowledgeId: kb._id.toString(),
                error: e.message
            });
            // Re-throw to prevent orphaned state — caller should handle failure
            throw new Error(`Failed to clean up vectors: ${e.message}`);
        }

        // CQ-7: Clean up S3/MinIO file to prevent orphaned storage
        if (kb.s3Key) {
            try {
                await minioClient.removeObject(MINIO_BUCKET, kb.s3Key);
            } catch (e: any) {
                LoggerService.warn('knowledge_minio_delete_failed', {
                    knowledgeId: kb._id.toString(),
                    s3Key: kb.s3Key,
                    error: e.message
                });
                // Non-fatal: continue with deletion even if S3 cleanup fails
            }
        }

        await Knowledge.findByIdAndDelete(kb._id);
        await Collection.updateMany(
            { knowledgeIds: kb._id },
            { $pull: { knowledgeIds: kb._id } }
        );
        return kb._id;
    }

    // --- Publishing ---
    /**
     * Request to publish personal knowledge to department/public.
     * - admin/superadmin: auto-approved (direct publish, no approval needed)
     * - staff/student: creates a pending request for admin review
     */
    static async requestPublish(id: string, user: UserContext, targetType: string) {
        const kb = await Knowledge.findById(id);
        if (!kb) throw new Error('Not found');
        if (kb.ownerId !== user.userId) throw new Error('Only owner can request publish');
        if (kb.type !== 'personal') throw new Error('Only personal knowledge can be requested');

        if (targetType !== 'public' && targetType !== 'department') {
            throw new Error('Invalid target type');
        }

        // Admin/superadmin: auto-approve — directly change type without approval workflow
        if (this.isAdmin(user)) {
            // Superadmin can publish to any scope; admin can publish within their department
            if (user.role !== 'superadmin' && targetType === 'public') {
                // Admin publishing to public — allowed (they can create public directly too)
            }
            kb.type = targetType as 'public' | 'department';
            kb.requestStatus = 'approved';
            kb.requestedType = targetType as 'public' | 'department';
            await kb.save();
            LoggerService.info('knowledge_auto_published', {
                knowledgeId: id,
                targetType,
                userId: user.userId,
                role: user.role
            });
            return kb;
        }

        // Staff/student: create pending request for admin approval
        kb.requestStatus = 'pending';
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
        else if (data.type === 'default' && this.isAdmin(user)) allowed = true;

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

    static async updateCollection(id: string, user: UserContext, data: { name?: string, description?: string, type?: string }) {
        const col = await Collection.findById(id);
        if (!col) throw new Error('Not found');
        if (!this.canManageCollection(user, col)) throw new Error('Permission denied');

        if (data.name) col.name = data.name;
        if (data.description !== undefined) col.description = data.description;

        // Allow type change (e.g. personal → department/default) with permission check
        if (data.type && data.type !== col.type) {
            const validTypes = ['personal', 'department', 'default'];
            if (!validTypes.includes(data.type)) throw new Error('Invalid collection type');

            // Only admin/superadmin can change to department or default (public)
            if ((data.type === 'department' || data.type === 'default') && !this.isAdmin(user)) {
                throw new Error('Only admin can set collection to department or public');
            }

            col.type = data.type as 'personal' | 'department' | 'default';
        }

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

        // Policy KB should not be mapped to collections — check_policy tool reads all policies directly via ChromaDB
        if (action === 'add' && kb.type === 'policy') {
            throw new Error('Policy knowledge cannot be added to collections. Policies are accessed automatically via the policy checker.');
        }

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

    static async getCollections(user: UserContext, pagination?: { page?: number; limit?: number }) {
        const page = Math.max(1, pagination?.page || 1);
        const limit = Math.min(200, Math.max(1, pagination?.limit || 50));
        const skip = (page - 1) * limit;

        // Superadmin sees all collections
        if (user.role === 'superadmin') {
            const total = await Collection.countDocuments({});
            const items = await Collection.find({}).sort({ type: 1, createdAt: -1 }).skip(skip).limit(limit);
            return { items, total, page, limit };
        }

        const query = {
            $or: [
                { type: 'default' },
                { type: 'department', department: user.department },
                { type: 'personal', ownerId: user.userId }
            ]
        };
        const total = await Collection.countDocuments(query);
        const items = await Collection.find(query).sort({ type: 1, createdAt: -1 }).skip(skip).limit(limit);
        return { items, total, page, limit };
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
        // Sanitize filename to prevent header injection (CQ-Security)
        const safeFilename = encodeURIComponent(kb.title).replace(/%20/g, ' ');
        return {
            stream,
            headers: {
                'content-type': kb.contentType,
                'content-disposition': `inline; filename="${safeFilename}"; filename*=UTF-8''${encodeURIComponent(kb.title)}`
            }
        };
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
