import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import busboy from 'busboy';
import { ChromaClient } from 'chromadb';
import axios from 'axios';
import pdf from 'pdf-parse';
import mongoose from 'mongoose';
import { Knowledge, IKnowledge, Collection, ICollection } from './models';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7000;
const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
const BEDROCK_EMBEDDING_URL = process.env.BEDROCK_EMBEDDING_URL || 'http://bedrock-embedding:5003/api/bedrock';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/mfulearnai_knowledge';
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';

// Setup
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database
mongoose.connect(MONGO_URI)
    .then(() => console.log('[Knowledge] Connected to MongoDB'))
    .catch(err => console.error('[Knowledge] MongoDB error:', err));

import { initMinio, minioClient, MINIO_BUCKET, MINIO_ENDPOINT, MINIO_PORT } from './minioClient';
import { initWorker, knowledgeQueue } from './queue';
import { getEmbedding } from './processingUtils';
import { AdapterFactory } from './adapters/AdapterFactory';

const adapterFactory = new AdapterFactory();

const chroma = new ChromaClient({ path: CHROMA_URL });
const GLOBAL_CHROMA_COLLECTION = "mfulearnai-global-kb";

// File Upload
// File Upload - Using Busboy (Streaming)

// --- Auth Middleware ---
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const PUBLIC_KEY_PATH = process.env.JWT_PUBLIC_KEY_PATH || '/run/secrets/jwt_public_key';

interface UserContext {
    userId: string;
    role: string;
    department: string;
}

const extractUser = (req: Request): UserContext | null => {
    // ZERO TRUST: Do NOT trust x-user-id headers. Always verify token.

    // Validate Bearer Token (Header or Query Param fallback for browser embeds)
    const authHeader = req.headers.authorization;
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token && typeof req.query.token === 'string') {
        // Fallback: Browser embeds (iframe/img) can't send Authorization headers
        // so the frontend passes the token as ?token= query parameter
        token = req.query.token;
    }

    if (token) {
        try {
            // A. Try User Token (HS256 - from Identity Service)
            try {
                const decodedUser: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
                if (decodedUser && decodedUser.userId) {
                    return {
                        userId: decodedUser.userId,
                        role: decodedUser.role || 'student',
                        department: decodedUser.department || 'General'
                    };
                }
            } catch (err: any) {
                // Debugging: Log why HS256 failed (likely secret mismatch if "invalid signature")
                if (err.message === 'invalid signature') {
                    console.warn('[Knowledge] User Token verification failed: invalid signature. POTENTIAL CONFIG ISSUE: Check JWT_SECRET mismatch between Identity and Knowledge services.');
                } else if (err.message === 'jwt expired') {
                    console.warn('[Knowledge] User Token verification failed: token expired.');
                }
                // Otherwise query might be an Internal Token (RS256), so we continue to B.
            }

            // B. Try Internal Token (RS256 - from Orchestrator)
            const fs = require('fs');
            // Check if key file exists
            if (fs.existsSync(PUBLIC_KEY_PATH)) {
                const publicKey = fs.readFileSync(PUBLIC_KEY_PATH);
                const decodedInternal: any = jwt.verify(token, publicKey, { algorithms: ['RS256'] });

                // STRICT VERIFICATION
                // 1. Check Audience (Use Service ID)
                if (decodedInternal.aud !== 'mfu-knowledge-service') {
                    console.warn('[Knowledge] Invalid audience:', decodedInternal.aud);
                    return null;
                }

                // 2. Check Type
                if (decodedInternal.typ !== 'internal-jwt') {
                    console.warn('[Knowledge] Invalid token type:', decodedInternal.typ);
                    return null;
                }

                // Internal Token: Check if impersonating a user via header
                // Trusted services (Orchestrator) pass x-user-id to scoped operations
                const impersonatedUserId = req.headers['x-user-id'] as string;
                const impersonatedRole = req.headers['x-role'] as string;

                return {
                    userId: impersonatedUserId || decodedInternal.sub || 'service:orchestrator',
                    role: impersonatedRole || 'admin',
                    department: 'Global'
                };
            }
        } catch (e) {
            console.warn(`[Knowledge] Token verification failed: ${e instanceof Error ? e.message : 'Unknown'}`);
        }
    }
    return null;
};

// --- DATA MODELS ---
// Moved to models.ts

// --- PERMISSION HELPERS ---

const canCreateKnowledge = (user: UserContext, type: string): boolean => {
    if (type === 'personal') return true;
    if (type === 'department' && user.role === 'admin') return true;
    if (type === 'public' && user.role === 'admin') return true; // Only dept admin can create public? User rule says: "Creatable only by admin of the same department"
    return false;
};

const canManageKnowledge = (user: UserContext, kb: IKnowledge): boolean => {
    if (kb.type === 'personal') return kb.ownerId === user.userId;
    if (kb.type === 'department') return user.role === 'admin' && user.department === kb.department;
    if (kb.type === 'public') return user.role === 'admin' && user.department === kb.department; // "Deletable/editable ONLY by admin of the owner department"
    return false;
};

const canReadKnowledge = (user: UserContext, kb: IKnowledge): boolean => {
    if (kb.type === 'public') return true;
    if (kb.type === 'department') return user.department === kb.department;
    if (kb.type === 'personal') return kb.ownerId === user.userId;
    return false;
};

const canManageCollection = (user: UserContext, col: ICollection): boolean => {
    if (col.type === 'default') return user.role === 'admin'; // "Only admin of every department can map knowledge into it"
    if (col.type === 'department') return user.role === 'admin' && user.department === col.department;
    if (col.type === 'personal') return col.ownerId === user.userId;
    return false;
};

// --- CORE LOGIC ---

// --- PERMISSION HELPERS ---

// Init Global Chroma Collection
async function initChroma() {
    try {
        await chroma.getOrCreateCollection({ name: GLOBAL_CHROMA_COLLECTION, metadata: { "hnsw:space": "cosine" } });
        console.log(`[Knowledge] Global Chroma collection initialized: ${GLOBAL_CHROMA_COLLECTION}`);
    } catch (e) {
        console.error('Chroma init failed:', e);
    }
}

// Init Default Collection (Mongo)
async function initDefaultCollection() {
    try {
        const existing = await Collection.findOne({ isDefault: true });
        if (!existing) {
            await Collection.create({
                name: 'Default Collection',
                description: 'General knowledge base available to everyone.',
                type: 'default',
                ownerId: 'system',
                department: 'Global',
                isDefault: true,
                knowledgeIds: []
            });
            console.log('[Knowledge] Default Collection created.');
        }
    } catch (e) { console.error('Default Col init failed:', e); }
}

// --- API ENDPOINTS ---

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// 1. CREATE KNOWLEDGE (Streaming Upload)
app.post('/api/knowledge', async (req: any, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const bb = busboy({ headers: req.headers });
    const kbId = new mongoose.Types.ObjectId();

    // State to capture during stream
    const fields: any = {};
    let uploadPromise: Promise<any> | null = null;
    let fileInfo: any = null;
    let hasFile = false;

    bb.on('file', (name, file, info) => {
        hasFile = true;
        const { filename, mimeType } = info;
        // Deterministic Key: knowledge/{id}/original.pdf
        // Preserves original extension?
        const ext = filename.split('.').pop() || 'dat';
        const s3Key = `knowledge/${kbId}/original.${ext}`;

        fileInfo = {
            originalName: Buffer.from(filename, 'latin1').toString('utf8'),
            mimeType,
            s3Key
        };

        console.log(`[Upload] Streaming ${filename} to ${s3Key}...`);

        // Stream to MinIO
        // Note: minioClient.putObject can take a stream. 
        // If size is unknown, it internally uses multipart upload.
        uploadPromise = minioClient.putObject(MINIO_BUCKET, s3Key, file, undefined, {
            'Content-Type': mimeType,
            'x-amz-meta-original-name': filename
        });
    });

    bb.on('field', (name, val) => {
        fields[name] = val;
    });

    bb.on('close', async () => {
        if (!hasFile) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
            await uploadPromise; // Wait for MinIO finish

            // Check Permissions
            const type = fields.type || 'personal';
            if (!canCreateKnowledge(user, type)) {
                // Cleanup S3?
                return res.status(403).json({ error: 'Insufficient permissions' });
            }

            // Create DB Record
            const kb = new Knowledge({
                _id: kbId,
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
                // s3Size: TODO: MinIO result usually has etag, but getting size might require statObject. 
                // We can skip size for now or fetch it in worker.
            });
            await kb.save();

            // Queue Job
            await knowledgeQueue.add('process-file', {
                knowledgeId: kb._id.toString(),
                s3Key: fileInfo.s3Key,
                mimetype: fileInfo.mimeType,
                originalName: fileInfo.originalName
            });

            res.status(202).json({
                success: true,
                knowledge: kb,
                message: 'File accepted. Streaming upload complete.'
            });

        } catch (e: any) {
            console.error('Streaming Upload Failed:', e);
            res.status(500).json({ error: 'Upload failed: ' + e.message });
        }
    });

    req.pipe(bb);
});

import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

// ... imports

// 1.01 EXTRACT TEXT (No Save)
app.post('/api/knowledge/extract', async (req: any, res: Response) => {
    // Basic Auth Check (Any authenticated user can extract)
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (!req.file) return res.status(400).json({ error: 'No file' });

    const { mimetype, buffer, originalname } = req.file;

    try {
        let text = '';

        // PDF
        if (mimetype === 'application/pdf') {
            text = (await pdf(buffer)).text;
        }
        // Text
        else if (mimetype === 'text/plain') {
            text = buffer.toString('utf-8');
        }
        // Word (DOCX)
        else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
            if (result.messages.length > 0) {
                console.log('Mammoth messages:', result.messages);
            }
        }
        // Excel / CSV (XLSX, XLS, CSV)
        else if (
            mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimetype === 'application/vnd.ms-excel' ||
            mimetype === 'text/csv' ||
            originalname.endsWith('.xlsx') ||
            originalname.endsWith('.xls') ||
            originalname.endsWith('.csv')
        ) {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetNames = workbook.SheetNames;

            // Extract text from all sheets
            sheetNames.forEach(name => {
                const sheet = workbook.Sheets[name];
                const csv = XLSX.utils.sheet_to_csv(sheet);
                text += `\n--- Sheet: ${name} ---\n${csv}`;
            });
        }
        else {
            return res.status(400).json({ error: `Unsupported file type: ${mimetype}` });
        }

        text = text.replace(/\s+/g, ' ').trim();
        if (!text) return res.status(400).json({ error: 'Empty text' });

        res.json({ success: true, text });
    } catch (e: any) {
        console.error('Extract error:', e);
        res.status(500).json({ error: e.message });
    }
});

// 1.01 PARSE FILE TO IR (Transient Context)
app.post('/api/knowledge/parse', async (req: any, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Use Busboy for stream or Multer (express middleware handled already for req.file?)
    // Note: The previous /extract endpoint used req.file which implies multer was used?
    // Looking at line 153 `busboy({ headers: req.headers })` suggesting manual handling?
    // Wait, line 262 checks `if (!req.file)`. This implies a middleware (like multer) WAS used in /extract context?
    // But looking at top of file, only `busboy` is imported. `express.urlencoded` / `json` is used.
    // Line 153 is manual busboy. Line 257 /extract endpoint expects `req.file`.
    // Where is `req.file` coming from?
    // Ah, I might have missed `multer` usage in previous view or it's missing in code.
    // Let's assume we need to handle streaming with Busboy OR use Multer.
    // Since /knowledge (line 153) uses busboy, let's use busboy for consistency and robustness with large files.

    const bb = busboy({ headers: req.headers });
    let fileBuffer: Buffer | null = null;
    let fileName = '';
    let mimeType = '';
    let fileFound = false;

    bb.on('file', (name, file, info) => {
        fileFound = true;
        fileName = Buffer.from(info.filename, 'latin1').toString('utf8');
        mimeType = info.mimeType;

        const chunks: any[] = [];
        file.on('data', (data) => chunks.push(data));
        file.on('end', () => {
            fileBuffer = Buffer.concat(chunks);
        });
    });

    bb.on('close', async () => {
        if (!fileFound || !fileBuffer) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
            const adapter = await adapterFactory.getAdapter(fileBuffer, fileName, mimeType);
            const ir = await adapter.parse(fileBuffer, fileName);
            res.json({ success: true, ir });
        } catch (e: any) {
            console.error('[Knowledge] Parse error:', e);
            res.status(500).json({ error: e.message });
        }
    });

    req.pipe(bb);
});


// 1.05 DELETE KNOWLEDGE
app.delete('/api/knowledge/:id', async (req: Request, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const kb = await Knowledge.findById(req.params.id);
        if (!kb) return res.status(404).json({ error: 'Not found' });

        // Permission Check
        if (!canManageKnowledge(user, kb)) {
            return res.status(403).json({ error: 'Not allowed to delete this knowledge' });
        }

        // 1. Delete from Chroma
        const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION } as any);
        await col.delete({ where: { knowledgeId: kb._id.toString() } });

        // 2. Delete from Mongo
        await Knowledge.findByIdAndDelete(kb._id);

        // 3. Remove from any collections (Cleanup)
        await Collection.updateMany(
            { knowledgeIds: kb._id },
            { $pull: { knowledgeIds: kb._id } }
        );

        res.json({ success: true, id: kb._id });
    } catch (e: any) {
        console.error('Delete error:', e);
        res.status(500).json({ error: e.message });
    }
});

// 1.06 RETRY PROCESSING (Refinement)
app.post('/api/knowledge/:id/retry', async (req: Request, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const kb = await Knowledge.findById(req.params.id);
        if (!kb) return res.status(404).json({ error: 'Not found' });

        if (!canManageKnowledge(user, kb)) {
            return res.status(403).json({ error: 'Not allowed to manage this knowledge' });
        }

        // Only retry if failed or stuck?
        // Let's allow retry anytime if status != completed, or even if completed (re-process)

        // Reset Status
        kb.processingStatus = 'pending';
        kb.processingStage = 'queued';
        kb.errorReason = '';
        await kb.save();

        // Check if S3 key exists?
        // We assume it does. Worker will fail again if not.

        // Re-Queue
        await knowledgeQueue.add('process-file', {
            knowledgeId: kb._id.toString(),
            s3Key: kb.s3Key,
            mimetype: kb.contentType || 'application/pdf', // Fallback
            originalName: kb.title
        });

        res.json({ success: true, knowledge: kb, message: 'Retry queued.' });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 1.1 REQUEST PUBLISH
app.post('/api/knowledge/:id/request-publish', async (req: Request, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { targetType } = req.body; // 'department' or 'public'

    try {
        const kb = await Knowledge.findById(req.params.id);
        if (!kb) return res.status(404).json({ error: 'Not found' });

        // Only owner can request
        if (kb.ownerId !== user.userId) return res.status(403).json({ error: 'Only owner can request publish' });

        // Only Personal can be promoted? Or Department to Public?
        // User rule: "student/staff ... have to create personal knowledge before request it"
        if (kb.type !== 'personal') return res.status(400).json({ error: 'Only personal knowledge can be requested for publishing' });

        kb.requestStatus = 'pending';
        kb.requestedType = targetType;
        await kb.save();

        res.json({ success: true, knowledge: kb });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 1.2 APPROVE PUBLISH (Admin)
app.post('/api/knowledge/:id/approve-publish', async (req: Request, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { action } = req.body; // 'approve' | 'reject'

    try {
        const kb = await Knowledge.findById(req.params.id);
        if (!kb) return res.status(404).json({ error: 'Not found' });

        // Check Admin of SAME department
        // "student/staff may REQUEST their department admin"
        if (user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
        if (user.department !== kb.department) return res.status(403).json({ error: 'Must be admin of owner department' });

        if (action === 'approve') {
            // Logic: "Knowledge created once". We change the type.
            if (kb.requestedType) {
                kb.type = kb.requestedType;
            }
            kb.requestStatus = 'approved';
        } else {
            kb.requestStatus = 'rejected';
        }

        // Reset request fields if needed, or keep history? 
        // Keeping status helps UI show "Approved".

        await kb.save();
        res.json({ success: true, knowledge: kb });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 2. CREATE COLLECTION
app.post('/api/knowledge/collections', async (req: Request, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { name, description, type } = req.body;
    // type: department, personal (default is system only usually, but maybe admin can create another default-like?)
    // Let's restrict: Admin -> Dept/Default. User -> Personal.

    // Validate creation permission logic
    // User requested: "Department Collection: Creatable only by admin of that department"
    // "Personal Collection: Creatable only by owner"

    let allowed = false;
    if (type === 'personal') allowed = true;
    else if (type === 'department' && user.role === 'admin') allowed = true;

    if (!allowed) return res.status(403).json({ error: 'Not allowed to create this collection type' });

    try {
        const newCol = await Collection.create({
            name,
            description,
            type,
            ownerId: user.userId,
            department: user.department,
            knowledgeIds: []
        });
        res.json({ success: true, collection: newCol });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 2.1 UPDATE COLLECTION
app.put('/api/knowledge/collections/:id', async (req: Request, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { name, description } = req.body;

    try {
        const col = await Collection.findById(req.params.id);
        if (!col) return res.status(404).json({ error: 'Not found' });

        if (!canManageCollection(user, col)) {
            return res.status(403).json({ error: 'Not allowed to update this collection' });
        }

        col.name = name || col.name;
        col.description = description !== undefined ? description : col.description;
        await col.save();

        res.json({ success: true, collection: col });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 2.2 DELETE COLLECTION
app.delete('/api/knowledge/collections/:id', async (req: Request, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const col = await Collection.findById(req.params.id);
        if (!col) return res.status(404).json({ error: 'Not found' });

        if (!canManageCollection(user, col)) {
            return res.status(403).json({ error: 'Not allowed to delete this collection' });
        }

        await Collection.findByIdAndDelete(req.params.id);
        res.json({ success: true, id: req.params.id });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 3. MAP KNOWLEDGE TO COLLECTION
app.post('/api/knowledge/collections/:id/map', async (req: Request, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { knowledgeId, action } = req.body; // action: 'add' | 'remove'

    try {
        const col = await Collection.findById(id);
        const kb = await Knowledge.findById(knowledgeId);

        if (!col || !kb) return res.status(404).json({ error: 'Not found' });

        // Check if user manages the COLLECTION
        if (!canManageCollection(user, col)) {
            return res.status(403).json({ error: 'Cannot modify this collection' });
        }

        // Validate Visibility Rule:
        // "Admin can manage any knowledge inside THEIR department collection"
        // "Default Collection: Only admin of every department can map knowledge into it"
        // Implicitly, you must be able to READ the knowledge to map it?
        // Or strictly: You own the knowledge?
        // User said: "Admin of other departments CANNOT delete or edit [Public Knowledge]"
        // But "Everyone can reference this knowledge in collections"

        // So checking if user can READ the knowledge is a good baseline for mapping.
        if (!canReadKnowledge(user, kb)) {
            return res.status(403).json({ error: 'Cannot access this knowledge to map it' });
        }

        if (action === 'add') {
            // Avoid duplicates using string comparison
            const exists = col.knowledgeIds.some((existingId: any) => existingId.toString() === kb._id.toString());
            if (!exists) {
                col.knowledgeIds.push(kb._id as any);
            }
        } else if (action === 'remove') {
            col.knowledgeIds = col.knowledgeIds.filter((k: any) => k.toString() !== knowledgeId);
        }

        await col.save();
        res.json({ success: true, collection: col });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 4. LIST COLLECTIONS (For User)
app.get('/api/knowledge/collections', async (req: Request, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        // Return:
        // 1. Default Collection (Always)
        // 2. My Department Collection
        // 3. My Personal Collections
        // 4. (Optional) Public Collections? User didn't specify Public Collections, only Public Knowledge.

        const query = {
            $or: [
                { type: 'default' },
                { type: 'department', department: user.department },
                { type: 'personal', ownerId: user.userId }
            ]
        };

        const collections = await Collection.find(query).sort({ type: 1, createdAt: -1 });
        res.json({ collections });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 5. GET COLLECTION DETAILS (List Knowledge inside)
app.get('/api/knowledge/collections/:id', async (req: Request, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const col = await Collection.findById(req.params.id).populate('knowledgeIds');
        if (!col) return res.status(404).json({ error: 'Not found' });

        // Access Check
        // Dept Col: Visible only to same dept
        // Personal Col: Visible only to owner
        // Default: Visible to everyone
        let canView = false;
        if (col.type === 'default') canView = true;
        else if (col.type === 'department' && col.department === user.department) canView = true;
        else if (col.type === 'personal' && col.ownerId === user.userId) canView = true;

        if (!canView) return res.status(403).json({ error: 'Access denied' });

        res.json({ collection: col });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// 6. STORAGE UPLOAD (Chat Attachments)
import { v4 as uuidv4 } from 'uuid';

app.post('/api/storage/upload', async (req: any, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const bb = busboy({ headers: req.headers });
    const CHAT_BUCKET = 'chat-attachments';

    let uploadPromise: Promise<any> | null = null;
    let fileInfo: any = null;
    let hasFile = false;

    bb.on('file', (name, file, info) => {
        hasFile = true;
        const { filename, mimeType } = info;
        // Key: {userId}/{date}/{uuid}-{filename}
        const dateStr = new Date().toISOString().split('T')[0];
        const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const s3Key = `${user.userId}/${dateStr}/${uuidv4()}-${safeName}`;

        fileInfo = {
            originalName: Buffer.from(filename, 'latin1').toString('utf8'), // Fix encoding
            mimeType,
            s3Key
        };

        // Stream to MinIO
        uploadPromise = minioClient.putObject(CHAT_BUCKET, s3Key, file, undefined, {
            'Content-Type': mimeType,
            'x-amz-meta-original-name': filename,
            'x-amz-meta-owner': user.userId
        });
    });

    bb.on('close', async () => {
        if (!hasFile) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        try {
            const objInfo = await uploadPromise; // Wait for MinIO finish

            // Generate Presigned URL for immediate preview (optional, valid for 1 hour)
            const previewUrl = await minioClient.presignedGetObject(CHAT_BUCKET, fileInfo.s3Key, 3600);

            res.json({
                success: true,
                data: {
                    key: fileInfo.s3Key,
                    fileName: fileInfo.originalName,
                    mimeType: fileInfo.mimeType,
                    url: previewUrl,
                    bucket: CHAT_BUCKET,
                    etag: objInfo?.etag
                }
            });

        } catch (e: any) {
            console.error('Storage Upload Failed:', e);
            res.status(500).json({ error: 'Upload failed: ' + e.message });
        }
    });

    req.pipe(bb);
});



app.get('/api/storage/file/*', async (req: any, res: Response) => {
    try {
        const user = extractUser(req);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        // Extract Key from wildcard
        const key = req.params[0];
        if (!key) return res.status(400).json({ error: 'Key required' });

        // Security: Ensure key belongs to user
        // Key format: {userId}/{date}/{uuid}-{filename}
        if (!key.startsWith(`${user.userId}/`)) {
            console.warn(`[Storage] Access Denied: User ${user.userId} tried to access ${key}`);
            return res.status(403).json({ error: 'Access denied' });
        }

        const dataStream = await minioClient.getObject('chat-attachments', key);
        try {
            const stat = await minioClient.statObject('chat-attachments', key);
            if (stat.metaData['content-type']) {
                res.setHeader('Content-Type', stat.metaData['content-type']);
            }
            res.setHeader('Content-Length', stat.size);
        } catch (e) {
            // Ignore stat error
        }
        dataStream.pipe(res);
    } catch (e: any) {
        console.error('Storage Download Failed:', e);
        res.status(500).json({ error: 'Download failed' });
    }
});

// 6. SEARCH (RAG) - PHASE 5: INTENT-AWARE
import { ReRankerService } from './ReRankerService';

app.post('/api/knowledge/search', async (req: Request, res: Response) => {
    const { query, collectionId, limit = 3, intent = 'QUERY' } = req.body;

    // Phase 5.2: Retrieval Policy Engine
    const POLICY: any = {
        'CHITCHAT': { k: 0, strategy: 'none' },
        'FACT_LOOKUP': { k: 3, strategy: 'high_precision', alpha: 0.3 },
        'RESEARCH': { k: 10, strategy: 'high_recall', alpha: 0.7 },
        'DESIGN': { k: 10, strategy: 'high_recall', alpha: 0.7 },
        'DEBUGGING': { k: 15, strategy: 'broad', alpha: 0.8 },
        'QUERY': { k: 5, strategy: 'balanced', alpha: 0.5 }
    };

    const policy = POLICY[intent] || POLICY['QUERY'];
    const dynamicLimit = policy.k;

    if (dynamicLimit === 0) {
        return res.json({ results: [] });
    }

    try {
        let targetKnowledgeIds: string[] = [];

        if (collectionId) {
            const col = await Collection.findById(collectionId);
            if (col && col.knowledgeIds.length > 0) {
                targetKnowledgeIds = col.knowledgeIds.map(id => id.toString());
            }
        } else {
            const def = await Collection.findOne({ isDefault: true });
            if (def && def.knowledgeIds.length > 0) {
                targetKnowledgeIds = def.knowledgeIds.map(id => id.toString());
            }
        }

        if (targetKnowledgeIds.length === 0) {
            return res.json({ results: [] });
        }

        // 1. CHROMA QUERY (Phase 5 - Fetch more for re-ranking)
        const embedding = await getEmbedding(query);
        const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION } as any);

        const results = await col.query({
            queryEmbeddings: [embedding],
            nResults: dynamicLimit * 3, // Fetch window for re-ranking
            where: { knowledgeId: { "$in": targetKnowledgeIds } }
        });

        // 2. HYBRID SCORING & CLAMPING
        const tokens: string[] = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 3);

        let hits = (results.documents[0] as string[]).map((doc: string, i: number) => {
            const safeDoc = doc || '';
            const semanticDist = results.distances?.[0][i] || 1;
            // Cosine distance to similarity: similarity = 1 - distance
            const semanticScore = Math.max(0, Math.min(1, 1 - semanticDist));

            // Simulating Keyword match (Fuzzy Keyword booster)
            let keywordMatches = 0;
            const docLower = doc?.toLowerCase() || '';
            tokens.forEach((t: string) => { if (docLower.includes(t)) keywordMatches++; });
            const keywordScore = tokens.length > 0 ? keywordMatches / tokens.length : 0;

            // WEIGHTED FUSION (RRF placeholder logic)
            const alpha = policy.alpha;
            const finalScore = (alpha * semanticScore) + ((1 - alpha) * keywordScore);

            return {
                content: doc,
                metadata: {
                    ...(results.metadatas?.[0]?.[i] || {}),
                    knowledgeId: results.metadatas?.[0]?.[i]?.knowledgeId // Ensure knowledgeId is explicitly passed
                },
                scores: { semantic: semanticScore, keyword: keywordScore, final: finalScore },
                score: finalScore // for sorting
            };
        });

        // Sort by final score
        hits.sort((a, b) => b.score - a.score);

        // 3. ENRICH WITH METADATA (Ownership/Privacy)
        const uniqueIds = Array.from(new Set(hits.map(h => h.metadata.knowledgeId as string))).filter(id => !!id);
        const kbDocs = await Knowledge.find({ _id: { $in: uniqueIds } }).select('ownerId type department');
        const kbMap = new Map(kbDocs.map(k => [k._id.toString(), k]));

        const enrichedHits = hits.map(h => {
            const kid = h.metadata.knowledgeId as string;
            const kb = kid ? kbMap.get(kid) : null;
            return {
                ...h,
                metadata: {
                    ...h.metadata,
                    ownerId: kb?.ownerId,
                    knowledgeType: kb?.type,
                    department: kb?.department
                }
            };
        });

        // 4. RE-RANKING (Sonnet/Haiku Stage)
        const validatedHits = await ReRankerService.reRank(query, intent, enrichedHits.slice(0, 15));

        // 5. LOGGING (Breakdown)
        console.info(`[RAG Search] Query: "${query}" | Intent: ${intent} | Strategy: ${policy.strategy}`);
        validatedHits.slice(0, 3).forEach((h, i) => {
            console.info(`  Rank ${i + 1}: S=${h.scores.semantic.toFixed(3)} K=${h.scores.keyword.toFixed(3)} F=${h.scores.final.toFixed(3)}`);
        });

        res.json({
            results: validatedHits.slice(0, dynamicLimit),
            metadata: {
                intent,
                strategy: policy.strategy,
                limit: dynamicLimit
            }
        });

    } catch (e: any) {
        console.error('Search error:', e);
        res.status(500).json({ error: 'Search failed' });
    }
});

// 6.5 VIEW KNOWLEDGE FILE (Original)
app.get('/api/knowledge/:id/view', async (req: Request, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const kb = await Knowledge.findById(req.params.id);
        if (!kb) return res.status(404).json({ error: 'Not found' });

        if (!canReadKnowledge(user, kb)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!kb.s3Key) return res.status(400).json({ error: 'No original file available for this item' });

        // Generate Presigned URL (Valid for 15 minutes)
        let url = await minioClient.presignedGetObject(MINIO_BUCKET, kb.s3Key, 15 * 60);

        // Phase 9.2: Support External Access if configured (for Browser)
        if (process.env.MINIO_EXTERNAL_URL) {
            url = url.replace(`${MINIO_ENDPOINT}:${MINIO_PORT}`, process.env.MINIO_EXTERNAL_URL);
        }

        res.json({ success: true, url, title: kb.title, contentType: kb.contentType });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Binary Stream Proxy (For Secure View)
app.get('/api/knowledge/:id/stream', async (req: Request, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    try {
        const kb = await Knowledge.findById(id);
        if (!kb) return res.status(404).json({ error: 'Item not found' });
        if (!canReadKnowledge(user, kb)) return res.status(403).json({ error: 'Insufficient permissions' });
        if (!kb.s3Key) return res.status(400).json({ error: 'No original file available' });

        const stream = await minioClient.getObject(MINIO_BUCKET, kb.s3Key);

        res.setHeader('Content-Type', kb.contentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(kb.title)}"`);

        stream.pipe(res);
    } catch (e: any) {
        console.error('[Knowledge] Stream Error:', e.message);
        if (!res.headersSent) res.status(500).json({ error: e.message });
    }
});

// 7. LIST KNOWLEDGE (Inventory for mapping)
app.get('/api/knowledge', async (req: Request, res: Response) => {
    const user = extractUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { type } = req.query;

    try {
        const filter: any = {};
        if (type === 'public') filter.type = 'public';
        else if (type === 'department') {
            filter.type = 'department';
            filter.department = user.department;
        } else if (type === 'personal') {
            filter.type = 'personal';
            filter.ownerId = user.userId;
        } else {
            // Return all visible?
            // Or handle specific lists for UI tabs?
            // Let's support complex OR if no type specified
            filter.$or = [
                { type: 'public' },
                { type: 'department', department: user.department },
                { type: 'personal', ownerId: user.userId }
            ];
        }

        // Add Request Status Filter (for Admin)
        if (req.query.requestStatus) {
            filter.requestStatus = req.query.requestStatus;
            // Admin can see requests from their dept
            if (user.role === 'admin') {
                filter.department = user.department;
                // If type was restricted in previous logic, make sure we don't accidentally strict it too much
                // But usually Admin Request view is specific. 
                // Let's ensure if requestStatus is pending, we allow seeing items even if they are 'personal' (but they are personally owned by others?)
                // Wait, personal items are owned by students. Admin needs to see them to approve.
                // My previous $or logic restricts to "ownerId: user.userId" for personal.
                // So an Admin CANNOT see student's personal items by default.

                // FIX: If fetching pending requests, override the visibility logic for Admin
                delete filter.$or; // Remove the standard visibility restriction
                filter.requestStatus = req.query.requestStatus;
                filter.department = user.department; // Admin only manages their dept
            }
        }

        const items = await Knowledge.find(filter).sort({ createdAt: -1 });
        res.json({ knowledge: items });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Start
app.listen(PORT, async () => {
    console.log(`[Knowledge Service] Port ${PORT} [Env: ${ENV_TYPE}]`);
    if (mongoose.connection.readyState === 1) {
        await initChroma();
        await initMinio();
        await initDefaultCollection();
        initWorker();
    } else {
        mongoose.connection.once('connected', async () => {
            await initChroma();
            await initMinio();
            await initDefaultCollection();
            initWorker();
        });
    }
});
