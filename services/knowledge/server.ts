import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import dotenv from 'dotenv';
import busboy from 'busboy';
import { ChromaClient } from 'chromadb';
import axios from 'axios';
import pdf from 'pdf-parse';
import mongoose, { Schema, Document } from 'mongoose';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7000;
const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
const BEDROCK_EMBEDDING_URL = process.env.BEDROCK_EMBEDDING_URL || 'http://localhost:5003/api/bedrock';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/mfulearnai_knowledge';
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';

// Setup
app.use(cors());
app.use(express.json());

// Database
mongoose.connect(MONGO_URI)
    .then(() => console.log('[Knowledge] Connected to MongoDB'))
    .catch(err => console.error('[Knowledge] MongoDB error:', err));

import { initMinio, minioClient, MINIO_BUCKET } from './minioClient';
import { initWorker, knowledgeQueue } from './queue';

const chroma = new ChromaClient({ path: CHROMA_URL });
const GLOBAL_CHROMA_COLLECTION = "mfulearnai-global-kb";

// File Upload
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB 
});

// --- Auth Middleware ---
// Mock or Extract from Gateway Headers if available. 
// Ideally, the Gateway validates JWT and passes User Info.
// For this strict RBAC, we'll try to decode the token passed in Authorization header for now
// or assume Gateway passes x-user-id, x-role, x-department.
// Let's implement a robust JWT decoder here assuming Bearer token is passed through.

interface UserContext {
    userId: string;
    role: string; // 'admin', 'teacher', 'student'
    department: string;
}

const extractUser = (req: Request): UserContext | null => {
    // Try headers from Gateway first (Preferred)
    const gwId = req.headers['x-user-id'] as string;
    const gwRole = req.headers['x-role'] as string;
    const gwDept = req.headers['x-department'] as string;

    if (gwId) {
        return { userId: gwId, role: gwRole || 'student', department: gwDept || 'General' };
    }

    // Fallback: Decode Bearer (If testing directly or Gateway passes through)
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded: any = jwt.decode(token);
            if (decoded) {
                return {
                    userId: decoded.userId || decoded.sub,
                    role: decoded.role || 'student',
                    department: decoded.department || 'General'
                };
            }
        } catch (e) { console.warn('Token decode failed'); }
    }
    return null;
};

// --- DATA MODELS ---

// 1. Knowledge (The Content)
interface IKnowledge extends Document {
    title: string;
    description?: string;
    type: 'public' | 'department' | 'personal';
    contentSource: string; // Filename for now
    ownerId: string;
    department: string;
    visibility: 'active' | 'archived';
    requestStatus: 'none' | 'pending' | 'approved' | 'rejected';
    requestedType?: 'public' | 'department';
    content?: string; // Store full text content
    createdAt: Date;
}

const KnowledgeSchema = new Schema({
    title: { type: String, required: true },
    description: String,
    type: { type: String, enum: ['public', 'department', 'personal'], required: true },
    contentSource: String,
    content: String, // New field
    ownerId: { type: String, required: true },
    department: { type: String, required: true },
    visibility: { type: String, default: 'active' },
    requestStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    requestedType: { type: String, enum: ['public', 'department'] },
    // Async Processing Fields
    processingStatus: { type: String, enum: ['none', 'pending', 'processing', 'completed', 'failed'], default: 'none' },
    processingStage: { type: String, enum: ['none', 'uploading', 'queued', 'extracting', 'chunking', 'embedding', 'indexing', 'completed'], default: 'none' },
    s3Key: String,
    s3Size: Number, // File size in bytes
    textHash: String, // SHA256 of extracted text
    errorReason: String,
    contentType: String
}, { timestamps: true });

const Knowledge = mongoose.model<IKnowledge>('Knowledge', KnowledgeSchema);

// 2. Collection (The Grouping)
interface ICollection extends Document {
    name: string;
    description?: string;
    type: 'default' | 'department' | 'personal';
    knowledgeIds: string[]; // List of Knowledge IDs
    ownerId: string;
    department: string;
    isDefault?: boolean;
}

const CollectionSchema = new Schema({
    name: { type: String, required: true },
    description: String,
    type: { type: String, enum: ['default', 'department', 'personal'], required: true },
    knowledgeIds: [{ type: Schema.Types.ObjectId, ref: 'Knowledge' }],
    ownerId: { type: String, required: true }, // 'system' for default
    department: { type: String, required: true },
    isDefault: { type: Boolean, default: false }
}, { timestamps: true });

const Collection = mongoose.model<ICollection>('Collection', CollectionSchema);

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
app.post('/api/knowledge/extract', upload.single('file'), async (req: any, res: Response) => {
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

// 6. SEARCH (RAG)
app.post('/api/knowledge/search', async (req: Request, res: Response) => {
    const { query, collectionId, limit = 3 } = req.body;

    // We don't necessarily have user context here if called from Orchestrator backend-to-backend without passing headers
    // BUT the Orchestrator should ideally pass the user context headers.
    // For now, let's assume if collectionId is provided, we check logic.
    // However, Orchestrator might call this. 
    // If collectionId is missing -> SEARCH DEFAULT.

    try {
        let targetKnowledgeIds: string[] = [];

        if (collectionId) {
            const col = await Collection.findById(collectionId);
            if (col && col.knowledgeIds.length > 0) {
                targetKnowledgeIds = col.knowledgeIds.map(id => id.toString());
            }
        } else {
            // Fallback to Default
            const def = await Collection.findOne({ isDefault: true });
            if (def && def.knowledgeIds.length > 0) {
                targetKnowledgeIds = def.knowledgeIds.map(id => id.toString());
            }
        }

        if (targetKnowledgeIds.length === 0) {
            return res.json({ results: [] });
        }

        // Chroma Query
        const embedding = await getEmbedding(query);
        const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION } as any);

        // Filter by logical OR of knowledgeIds. 
        // Chroma $in syntax: { knowledgeId: { $in: [id1, id2] } }
        const results = await col.query({
            queryEmbeddings: [embedding],
            nResults: limit,
            where: { knowledgeId: { "$in": targetKnowledgeIds } }
        });

        // Format
        const hits = results.documents[0].map((doc, i) => ({
            content: doc,
            metadata: results.metadatas[0][i],
            score: results.distances?.[0][i]
        }));

        res.json({ results: hits });

    } catch (e: any) {
        console.error('Search error:', e);
        res.status(500).json({ error: 'Search failed' });
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
