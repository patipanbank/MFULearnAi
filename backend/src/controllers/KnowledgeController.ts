import { Request, Response } from 'express';
import { KnowledgeService } from '../services/KnowledgeService';
import busboy from 'busboy';
import mongoose from 'mongoose';
import { minioClient, MINIO_BUCKET } from '../knowledge/minioClient';
import { AdapterFactory } from '../knowledge/adapters/AdapterFactory';
import { LoggerService } from '../services/LoggerService';
import { UserContext } from '../knowledge/types';

const adapterFactory = new AdapterFactory();

// Limits aligned with nginx client_max_body_size
const MAX_KNOWLEDGE_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_EXTRACT_FILE_SIZE = 20 * 1024 * 1024; // 20 MB (in-memory processing)

const extractUser = (req: Request): UserContext | null => {
    // Rely on Auth Middleware to populate req.user
    const user = (req as any).user;
    if (!user) return null;
    return {
        userId: user.userId || user.sub,
        role: user.role || 'student',
        department: user.department || 'General'
    };
};

export class KnowledgeController {

    // 0. LIST KNOWLEDGE
    // Supports query params: ?type=personal|department|public|policy  &requestStatus=pending|approved|rejected  &page=1  &limit=50
    static async listKnowledge(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        try {
            const filters: { type?: string; requestStatus?: string; page?: number; limit?: number } = {};

            if (req.query.type && typeof req.query.type === 'string') {
                filters.type = req.query.type;
            }
            if (req.query.requestStatus && typeof req.query.requestStatus === 'string') {
                filters.requestStatus = req.query.requestStatus;
            }
            if (req.query.page) {
                filters.page = parseInt(req.query.page as string, 10) || 1;
            }
            if (req.query.limit) {
                filters.limit = parseInt(req.query.limit as string, 10) || 50;
            }

            const result = await KnowledgeService.getKnowledgeList(user, filters);
            res.json({
                knowledge: result.items,
                pagination: { total: result.total, page: result.page, limit: result.limit }
            });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    // 1. CREATE KNOWLEDGE (Streaming Upload)
    static async create(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const bb = busboy({
            headers: req.headers,
            limits: { fileSize: MAX_KNOWLEDGE_FILE_SIZE }
        });
        const kbId = new mongoose.Types.ObjectId();

        const fields: Record<string, string> = {};
        let uploadPromise: Promise<unknown> | null = null;
        let fileInfo: { originalName: string; mimeType: string; s3Key: string } | null = null;
        let hasFile = false;

        bb.on('file', (name, file, info) => {
            hasFile = true;
            const { filename, mimeType } = info;
            const ext = filename.split('.').pop()?.toLowerCase() || 'dat';
            const s3Key = `knowledge/${kbId}/original.${ext}`;

            // Decode filename from latin1 (busboy default) to utf8
            const decodedName = Buffer.from(filename, 'latin1').toString('utf8');

            fileInfo = {
                originalName: decodedName,
                mimeType,
                s3Key
            };

            // Handle file size limit exceeded
            file.on('limit', () => {
                LoggerService.error('upload_file_size_exceeded', { fileName: decodedName });
                file.resume(); // Drain the stream
            });

            LoggerService.info('upload_streaming', { fileName: decodedName, s3Key });
            uploadPromise = minioClient.putObject(MINIO_BUCKET, s3Key, file, undefined, {
                'Content-Type': mimeType,
                'x-amz-meta-original-name': encodeURIComponent(decodedName)
            });
        });

        bb.on('field', (name, val) => {
            fields[name] = val;
        });

        bb.on('error', (err: any) => {
            LoggerService.error('upload_busboy_error', { error: err.message });
            if (!res.headersSent) {
                res.status(400).json({ error: 'Upload parsing failed: ' + err.message });
            }
        });

        bb.on('close', async () => {
            if (!hasFile || !fileInfo) return res.status(400).json({ error: 'No file uploaded' });

            try {
                await uploadPromise;
                const kb = await KnowledgeService.createKnowledgeRecord(user, fileInfo, fields);
                res.status(202).json({ success: true, knowledge: kb, message: 'File accepted.' });
            } catch (e: any) {
                LoggerService.error('upload_failed', { error: e.message });
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Upload failed: ' + e.message });
                }
            }
        });

        req.pipe(bb);
    }

    // 1.05 CREATE KNOWLEDGE FROM URL (Scraping)
    static async createFromUrl(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { url, type, folder, expiresAt } = req.body;
        if (!url) return res.status(400).json({ error: 'Missing URL' });

        try {
            const kb = await KnowledgeService.createFromUrl(user, url, type, { folder, expiresAt });
            res.status(202).json({ success: true, knowledge: kb, message: 'URL scraping task started.' });
        } catch (e: any) {
            LoggerService.error('url_scrape_failed', { error: e.message });
            res.status(500).json({ error: e.message || 'URL scraping failed' });
        }
    }

    // 1.06 CREATE KNOWLEDGE FROM TEXT (Direct Input)
    static async createFromText(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { title, text, type, folder, expiresAt } = req.body;
        if (!title || !text) return res.status(400).json({ error: 'Missing title or text content' });

        const kbId = new mongoose.Types.ObjectId();
        const s3Key = `knowledge/${kbId}/original.txt`;
        const originalName = `${title}.txt`;

        try {
            // 1. Convert text to Buffer
            const buffer = Buffer.from(text, 'utf-8');

            // 2. Upload directly to MinIO
            LoggerService.info('upload_text_direct', { fileName: originalName, s3Key });
            await minioClient.putObject(MINIO_BUCKET, s3Key, buffer, buffer.length, {
                'Content-Type': 'text/plain',
                'x-amz-meta-original-name': encodeURIComponent(originalName)
            });

            // 3. Create DB Record to trigger worker
            const fileInfo = {
                originalName,
                mimeType: 'text/plain',
                s3Key
            };
            const fields = { type, folder, expiresAt };

            const kb = await KnowledgeService.createKnowledgeRecord(user, fileInfo, fields, kbId);
            res.status(202).json({ success: true, knowledge: kb, message: 'Text content accepted for processing.' });
        } catch (e: any) {
            LoggerService.error('text_upload_failed', { error: e.message });
            res.status(500).json({ error: e.message || 'Text upload failed' });
        }
    }

    // 1.01 EXTRACT TEXT (No Save) via Memory Upload (Small files)
    static async extract(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const bb = busboy({
            headers: req.headers,
            limits: { fileSize: MAX_EXTRACT_FILE_SIZE }
        });
        let fileBuffer: Buffer | null = null;
        let mimeType = '';
        let fileName = '';
        let fileTruncated = false;

        bb.on('file', (name, file, info) => {
            mimeType = info.mimeType;
            fileName = Buffer.from(info.filename, 'latin1').toString('utf8');
            const chunks: Buffer[] = [];
            file.on('data', (data) => chunks.push(data));
            file.on('limit', () => { fileTruncated = true; });
            file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
        });

        bb.on('error', (err: any) => {
            LoggerService.error('extract_busboy_error', { error: err.message });
            if (!res.headersSent) {
                res.status(400).json({ error: 'File parsing failed: ' + err.message });
            }
        });

        bb.on('close', async () => {
            if (fileTruncated) {
                return res.status(413).json({
                    error: `File exceeds ${MAX_EXTRACT_FILE_SIZE / (1024 * 1024)} MB limit for text extraction`
                });
            }
            if (!fileBuffer) return res.status(400).json({ error: 'No file' });
            try {
                const adapter = await adapterFactory.getAdapter(fileBuffer, fileName, mimeType);
                const ir = await adapter.parse(fileBuffer, fileName);
                const text = ir.blocks.map((b: any) => b.content).join('\n\n');
                res.json({ success: true, text });
            } catch (e: any) {
                res.status(500).json({ error: e.message });
            }
        });
        req.pipe(bb);
    }

    // 1.05 DELETE
    static async delete(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const id = await KnowledgeService.deleteKnowledge(req.params.id, user);
            res.json({ success: true, id });
        } catch (e: any) {
            const msg = e.message || 'Delete failed';
            if (msg.includes('Not found')) return res.status(404).json({ error: msg });
            if (msg.includes('Permission')) return res.status(403).json({ error: msg });
            res.status(500).json({ error: msg });
        }
    }

    // 1.06 RETRY
    static async retry(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const kb = await KnowledgeService.retryProcessing(req.params.id, user);
            res.json({ success: true, knowledge: kb });
        } catch (e: any) {
            const msg = e.message || 'Retry failed';
            if (msg.includes('Not found')) return res.status(404).json({ error: msg });
            if (msg.includes('Permission')) return res.status(403).json({ error: msg });
            res.status(500).json({ error: msg });
        }
    }

    // 1.07 UPDATE (title, description, tags, folder, expiresAt)
    static async update(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { title, description, tags, folder, expiresAt } = req.body;
        if (title === undefined && description === undefined && tags === undefined && folder === undefined && expiresAt === undefined) {
            return res.status(400).json({ error: 'Nothing to update.' });
        }

        try {
            const kb = await KnowledgeService.updateKnowledge(req.params.id, user, { title, description, tags, folder, expiresAt });
            res.json({ success: true, knowledge: kb });
        } catch (e: any) {
            const msg = e.message || 'Update failed';
            if (msg.includes('Not found')) return res.status(404).json({ error: msg });
            if (msg.includes('Permission')) return res.status(403).json({ error: msg });
            res.status(400).json({ error: msg });
        }
    }

    // 1.08 KNOWLEDGE STATS (admin dashboard)
    static async getStats(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const stats = await KnowledgeService.getStats(user);
            res.json(stats);
        } catch (e: any) {
            const msg = e.message || 'Failed to get stats';
            if (msg.includes('Admin')) return res.status(403).json({ error: msg });
            res.status(500).json({ error: msg });
        }
    }

    // 1.09 DOCUMENT ANALYTICS (per-document detail)
    static async getDocumentAnalytics(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const analytics = await KnowledgeService.getDocumentAnalytics(req.params.id, user);
            res.json(analytics);
        } catch (e: any) {
            const msg = e.message || 'Failed to get analytics';
            if (msg.includes('Not found')) return res.status(404).json({ error: msg });
            if (msg.includes('Permission')) return res.status(403).json({ error: msg });
            res.status(500).json({ error: msg });
        }
    }

    // 1.1 REQUEST PUBLISH
    static async requestPublish(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { targetType } = req.body;
        if (!targetType || !['department', 'public'].includes(targetType)) {
            return res.status(400).json({ error: 'Invalid or missing targetType. Must be "department" or "public".' });
        }

        try {
            const kb = await KnowledgeService.requestPublish(req.params.id, user, targetType);
            res.json({ success: true, knowledge: kb });
        } catch (e: any) {
            const msg = e.message || 'Request publish failed';
            if (msg.includes('Not found')) return res.status(404).json({ error: msg });
            if (msg.includes('owner') || msg.includes('Permission') || msg.includes('personal')) {
                return res.status(403).json({ error: msg });
            }
            res.status(500).json({ error: msg });
        }
    }

    // 1.2 APPROVE PUBLISH
    static async approvePublish(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { action } = req.body;
        if (!action || !['approve', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Invalid or missing action. Must be "approve" or "reject".' });
        }

        try {
            const kb = await KnowledgeService.approvePublish(req.params.id, user, action);
            res.json({ success: true, knowledge: kb });
        } catch (e: any) {
            const msg = e.message || 'Approve action failed';
            if (msg.includes('Not found')) return res.status(404).json({ error: msg });
            if (msg.includes('Admin') || msg.includes('admin') || msg.includes('Permission')) {
                return res.status(403).json({ error: msg });
            }
            res.status(500).json({ error: msg });
        }
    }

    // 2. COLLECTIONS
    static async getCollections(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const pagination = {
                page: req.query.page ? parseInt(req.query.page as string, 10) : undefined,
                limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
            };
            const result = await KnowledgeService.getCollections(user, pagination);
            res.json({
                collections: result.items,
                pagination: { total: result.total, page: result.page, limit: result.limit }
            });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    static async getCollectionDetails(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const collection = await KnowledgeService.getCollectionDetails(req.params.id, user);
            res.json({ collection });
        } catch (e: any) {
            const msg = e.message || 'Failed';
            if (msg.includes('Not found')) return res.status(404).json({ error: msg });
            if (msg.includes('Access denied') || msg.includes('Permission')) return res.status(403).json({ error: msg });
            res.status(500).json({ error: msg });
        }
    }

    static async createCollection(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        // Input validation
        const { name, type } = req.body;
        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'Collection name is required' });
        }
        if (!type || !['personal', 'department', 'default'].includes(type)) {
            return res.status(400).json({ error: 'Invalid collection type. Must be "personal", "department", or "default".' });
        }

        try {
            const col = await KnowledgeService.createCollection(user, req.body);
            res.status(201).json({ success: true, collection: col });
        } catch (e: any) {
            const msg = e.message || 'Create failed';
            if (msg.includes('Not allowed') || msg.includes('Permission')) return res.status(403).json({ error: msg });
            res.status(500).json({ error: msg });
        }
    }

    static async updateCollection(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const col = await KnowledgeService.updateCollection(req.params.id, user, req.body);
            res.json({ success: true, collection: col });
        } catch (e: any) {
            const msg = e.message || 'Update failed';
            if (msg.includes('Not found')) return res.status(404).json({ error: msg });
            if (msg.includes('Permission') || msg.includes('Only admin')) return res.status(403).json({ error: msg });
            if (msg.includes('Invalid')) return res.status(400).json({ error: msg });
            res.status(500).json({ error: msg });
        }
    }

    static async deleteCollection(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const id = await KnowledgeService.deleteCollection(req.params.id, user);
            res.json({ success: true, id });
        } catch (e: any) {
            const msg = e.message || 'Delete failed';
            if (msg.includes('Not found')) return res.status(404).json({ error: msg });
            if (msg.includes('Permission')) return res.status(403).json({ error: msg });
            res.status(500).json({ error: msg });
        }
    }

    static async mapKnowledge(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        // Input validation
        const { knowledgeId, action } = req.body;
        if (!knowledgeId || typeof knowledgeId !== 'string') {
            return res.status(400).json({ error: 'knowledgeId is required' });
        }
        if (!action || !['add', 'remove'].includes(action)) {
            return res.status(400).json({ error: 'action must be "add" or "remove"' });
        }

        try {
            const col = await KnowledgeService.mapKnowledgeToCollection(req.params.id, user, knowledgeId, action);
            res.json({ success: true, collection: col });
        } catch (e: any) {
            const msg = e.message || 'Map failed';
            if (msg.includes('Not found')) return res.status(404).json({ error: msg });
            if (msg.includes('Permission') || msg.includes('Cannot access')) return res.status(403).json({ error: msg });
            res.status(500).json({ error: msg });
        }
    }

    // VIEW / STREAM
    static async view(req: Request, res: Response) {
        const { id } = req.params;
        let user: UserContext | null = extractUser(req);

        // TODO: Implement token query support in Auth Middleware for browser-based PDF viewer
        // Currently, browser requests with ?token= query param are not auto-authenticated.
        // The auth middleware needs to check req.query.token as a fallback.

        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        try {
            const { stream, headers } = await KnowledgeService.getFileStream(id, user);
            res.set(headers);

            // Handle stream errors to prevent dangling connections
            (stream as any).on('error', (err: any) => {
                LoggerService.error('knowledge_view_stream_error', { id, error: err.message });
                if (!res.headersSent) {
                    res.status(500).json({ error: 'File streaming failed' });
                } else {
                    res.end();
                }
            });

            (stream as any).pipe(res);
        } catch (e: any) {
            const msg = e.message || 'View failed';
            if (!res.headersSent) {
                if (msg.includes('Not found')) return res.status(404).json({ error: msg });
                if (msg.includes('Permission')) return res.status(403).json({ error: msg });
                res.status(500).json({ error: msg });
            }
        }
    }
}
