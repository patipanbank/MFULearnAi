import { Request, Response } from 'express';
import { KnowledgeService } from '../services/KnowledgeService';
import busboy from 'busboy';
import mongoose from 'mongoose';
import { minioClient, MINIO_BUCKET } from '../knowledge/minioClient';
import { AdapterFactory } from '../knowledge/adapters/AdapterFactory';

const adapterFactory = new AdapterFactory();

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

    // 1. CREATE KNOWLEDGE (Streaming Upload)
    static async create(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const bb = busboy({ headers: req.headers });
        const kbId = new mongoose.Types.ObjectId();

        const fields: any = {};
        let uploadPromise: Promise<any> | null = null;
        let fileInfo: any = null;
        let hasFile = false;

        bb.on('file', (name, file, info) => {
            hasFile = true;
            const { filename, mimeType } = info;
            const ext = filename.split('.').pop() || 'dat';
            const s3Key = `knowledge/${kbId}/original.${ext}`;

            fileInfo = {
                originalName: Buffer.from(filename, 'latin1').toString('utf8'),
                mimeType,
                s3Key
            };

            console.log(`[Upload] Streaming ${filename} to ${s3Key}...`);
            uploadPromise = minioClient.putObject(MINIO_BUCKET, s3Key, file, undefined, {
                'Content-Type': mimeType,
                'x-amz-meta-original-name': encodeURIComponent(fileInfo.originalName)
            });
        });

        bb.on('field', (name, val) => {
            fields[name] = val;
        });

        bb.on('close', async () => {
            if (!hasFile) return res.status(400).json({ error: 'No file uploaded' });

            try {
                await uploadPromise;
                const kb = await KnowledgeService.createKnowledgeRecord(user, fileInfo, fields);
                res.status(202).json({ success: true, knowledge: kb, message: 'File accepted.' });
            } catch (e: any) {
                console.error('Upload Failed:', e);
                res.status(500).json({ error: 'Upload failed: ' + e.message });
            }
        });

        req.pipe(bb);
    }

    // 1.01 EXTRACT TEXT (No Save) via Memory Upload (Small files) - OR Streaming?
    // Controller logic from server.ts used Multer/Busboy. Let's use busboy for consistency.
    static async extract(req: Request, res: Response) {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const bb = busboy({ headers: req.headers });
        let fileBuffer: Buffer | null = null;
        let mimeType = '';
        let fileName = '';

        bb.on('file', (name, file, info) => {
            mimeType = info.mimeType;
            fileName = Buffer.from(info.filename, 'latin1').toString('utf8');
            const chunks: any[] = [];
            file.on('data', (data) => chunks.push(data));
            file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
        });

        bb.on('close', async () => {
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
        // Support token query for browser
        let user: UserContext | null = extractUser(req);
        if (!user && req.query.token) {
            // ... token decode logic from server.ts ...
            // Simplified: if token param exists, assume middleware might update req.user or we verify here.
            // Since checkAuth middleware usually handles Header, if we want param support we need middleware adjustment or logic here.
            // For now, let's assume checkAuth handles it or we skip strictly for now.
            // TODO: Implement token query support in Auth Middleware or here.
        }

        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        try {
            const { stream, headers } = await KnowledgeService.getFileStream(id, user);
            res.set(headers);
            (stream as any).pipe(res);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    }
}
