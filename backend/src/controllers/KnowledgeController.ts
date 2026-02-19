import { Request, Response } from 'express';
import { KnowledgeService } from '../services/KnowledgeService';
import busboy from 'busboy';
import mongoose from 'mongoose';
import { minioClient, MINIO_BUCKET } from '../knowledge/minioClient';
import { AdapterFactory } from '../knowledge/adapters/AdapterFactory';

const adapterFactory = new AdapterFactory();

// Limits aligned with nginx client_max_body_size
const MAX_KNOWLEDGE_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_EXTRACT_FILE_SIZE = 20 * 1024 * 1024; // 20 MB (in-memory processing)

interface UserContext {
    userId: string;
    role: string;
    department: string;
}

const extractUser = (req: Request): UserContext | null => {
    // Rely on Auth Middleware to populate req.user or similar
    // Authentication is handled by middleware, but we need to extract user info for service calls
    const user = (req as any).user;
    if (!user) return null;
    return {
        userId: user.userId || user.sub, // Adjust based on Token payload
        role: user.role || 'student',     // Default role
        department: user.department || 'General' // Default dept
    };
};

export class KnowledgeController {

    // 0. LIST KNOWLEDGE
    static async listKnowledge(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        try {
            const knowledge = await KnowledgeService.getKnowledgeList(user);
            res.json({ knowledge });
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

        const fields: any = {};
        let uploadPromise: Promise<any> | null = null;
        let fileInfo: any = null;
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
                console.error(`[Upload] File size limit exceeded for ${decodedName}`);
                file.resume(); // Drain the stream
            });

            console.log(`[Upload] Streaming ${decodedName} to ${s3Key}...`);
            uploadPromise = minioClient.putObject(MINIO_BUCKET, s3Key, file, undefined, {
                'Content-Type': mimeType,
                'x-amz-meta-original-name': encodeURIComponent(decodedName)
            });
        });

        bb.on('field', (name, val) => {
            fields[name] = val;
        });

        bb.on('error', (err: any) => {
            console.error('[Upload] Busboy error:', err.message);
            if (!res.headersSent) {
                res.status(400).json({ error: 'Upload parsing failed: ' + err.message });
            }
        });

        bb.on('close', async () => {
            if (!hasFile) return res.status(400).json({ error: 'No file uploaded' });

            try {
                await uploadPromise;
                const kb = await KnowledgeService.createKnowledgeRecord(user, fileInfo, fields);
                res.status(202).json({ success: true, knowledge: kb, message: 'File accepted.' });
            } catch (e: any) {
                console.error('Upload Failed:', e);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Upload failed: ' + e.message });
                }
            }
        });

        req.pipe(bb);
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
            const chunks: any[] = [];
            file.on('data', (data) => chunks.push(data));
            file.on('limit', () => { fileTruncated = true; });
            file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
        });

        bb.on('error', (err: any) => {
            console.error('[Extract] Busboy error:', err.message);
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
            res.status(500).json({ error: e.message });
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
            res.status(500).json({ error: e.message });
        }
    }

    // 1.1 REQUEST PUBLISH
    static async requestPublish(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const kb = await KnowledgeService.requestPublish(req.params.id, user, req.body.targetType);
            res.json({ success: true, knowledge: kb });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    // 1.2 APPROVE PUBLISH
    static async approvePublish(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const kb = await KnowledgeService.approvePublish(req.params.id, user, req.body.action);
            res.json({ success: true, knowledge: kb });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    // 2. COLLECTIONS
    static async getCollections(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const collections = await KnowledgeService.getCollections(user);
            res.json({ collections });
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
            res.status(500).json({ error: e.message });
        }
    }

    static async createCollection(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const col = await KnowledgeService.createCollection(user, req.body);
            res.json({ success: true, collection: col });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    static async updateCollection(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const col = await KnowledgeService.updateCollection(req.params.id, user, req.body);
            res.json({ success: true, collection: col });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    static async deleteCollection(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const id = await KnowledgeService.deleteCollection(req.params.id, user);
            res.json({ success: true, id });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }

    static async mapKnowledge(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        try {
            const col = await KnowledgeService.mapKnowledgeToCollection(req.params.id, user, req.body.knowledgeId, req.body.action);
            res.json({ success: true, collection: col });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
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
                console.error(`[KnowledgeView] Stream error for ${id}:`, err.message);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'File streaming failed' });
                } else {
                    res.end();
                }
            });

            (stream as any).pipe(res);
        } catch (e: any) {
            if (!res.headersSent) {
                res.status(500).json({ error: e.message });
            }
        }
    }
}
