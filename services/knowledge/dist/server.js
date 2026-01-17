"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const multer_1 = __importDefault(require("multer"));
const chromadb_1 = require("chromadb");
const axios_1 = __importDefault(require("axios"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mongoose_1 = __importStar(require("mongoose"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 7000;
const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
const BEDROCK_URL = process.env.BEDROCK_URL || 'http://bedrock-service:5000/api/bedrock'; // Internal
const MONGO_URI = process.env.MONGO_URI || 'mongodb://mongo:27017/mfulearnai_knowledge';
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';
// Setup
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Database
mongoose_1.default.connect(MONGO_URI)
    .then(() => console.log('[Knowledge] Connected to MongoDB'))
    .catch(err => console.error('[Knowledge] MongoDB error:', err));
const chroma = new chromadb_1.ChromaClient({ path: CHROMA_URL });
const GLOBAL_CHROMA_COLLECTION = "mfulearnai-global-kb";
// File Upload
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB 
});
const extractUser = (req) => {
    // Try headers from Gateway first (Preferred)
    const gwId = req.headers['x-user-id'];
    const gwRole = req.headers['x-role'];
    const gwDept = req.headers['x-department'];
    if (gwId) {
        return { userId: gwId, role: gwRole || 'student', department: gwDept || 'General' };
    }
    // Fallback: Decode Bearer (If testing directly or Gateway passes through)
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jsonwebtoken_1.default.decode(token);
            if (decoded) {
                return {
                    userId: decoded.userId || decoded.sub,
                    role: decoded.role || 'student',
                    department: decoded.department || 'General'
                };
            }
        }
        catch (e) {
            console.warn('Token decode failed');
        }
    }
    return null;
};
const KnowledgeSchema = new mongoose_1.Schema({
    title: { type: String, required: true },
    description: String,
    type: { type: String, enum: ['public', 'department', 'personal'], required: true },
    contentSource: String,
    ownerId: { type: String, required: true },
    department: { type: String, required: true },
    visibility: { type: String, default: 'active' },
    requestStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    requestedType: { type: String, enum: ['public', 'department'] }
}, { timestamps: true });
const Knowledge = mongoose_1.default.model('Knowledge', KnowledgeSchema);
const CollectionSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    description: String,
    type: { type: String, enum: ['default', 'department', 'personal'], required: true },
    knowledgeIds: [{ type: mongoose_1.Schema.Types.ObjectId, ref: 'Knowledge' }],
    ownerId: { type: String, required: true }, // 'system' for default
    department: { type: String, required: true },
    isDefault: { type: Boolean, default: false }
}, { timestamps: true });
const Collection = mongoose_1.default.model('Collection', CollectionSchema);
// --- PERMISSION HELPERS ---
const canCreateKnowledge = (user, type) => {
    if (type === 'personal')
        return true;
    if (type === 'department' && user.role === 'admin')
        return true;
    if (type === 'public' && user.role === 'admin')
        return true; // Only dept admin can create public? User rule says: "Creatable only by admin of the same department"
    return false;
};
const canManageKnowledge = (user, kb) => {
    if (kb.type === 'personal')
        return kb.ownerId === user.userId;
    if (kb.type === 'department')
        return user.role === 'admin' && user.department === kb.department;
    if (kb.type === 'public')
        return user.role === 'admin' && user.department === kb.department; // "Deletable/editable ONLY by admin of the owner department"
    return false;
};
const canReadKnowledge = (user, kb) => {
    if (kb.type === 'public')
        return true;
    if (kb.type === 'department')
        return user.department === kb.department;
    if (kb.type === 'personal')
        return kb.ownerId === user.userId;
    return false;
};
const canManageCollection = (user, col) => {
    if (col.type === 'default')
        return user.role === 'admin'; // "Only admin of every department can map knowledge into it"
    if (col.type === 'department')
        return user.role === 'admin' && user.department === col.department;
    if (col.type === 'personal')
        return col.ownerId === user.userId;
    return false;
};
// --- CORE LOGIC ---
async function getEmbedding(text) {
    try {
        const response = await axios_1.default.post(`${BEDROCK_URL}/embeddings`, { text });
        if (response.data && response.data.embedding)
            return response.data.embedding;
        throw new Error('Invalid Bedrock response');
    }
    catch (e) {
        console.error('Embedding failed:', e.message);
        throw e;
    }
}
function chunkText(text) {
    const chunkSize = 1000, overlap = 200;
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start += (chunkSize - overlap);
    }
    return chunks;
}
// Init Global Chroma Collection
async function initChroma() {
    try {
        await chroma.getOrCreateCollection({ name: GLOBAL_CHROMA_COLLECTION, metadata: { "hnsw:space": "cosine" } });
        console.log(`[Knowledge] Global Chroma collection initialized: ${GLOBAL_CHROMA_COLLECTION}`);
    }
    catch (e) {
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
    }
    catch (e) {
        console.error('Default Col init failed:', e);
    }
}
// --- API ENDPOINTS ---
app.get('/health', (req, res) => res.json({ status: 'ok' }));
// 1. CREATE KNOWLEDGE (Upload)
app.post('/api/knowledge', upload.single('file'), async (req, res) => {
    const user = extractUser(req);
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    if (!req.file)
        return res.status(400).json({ error: 'No file' });
    const { type = 'personal' } = req.body; // public, department, personal
    // Permission Check
    if (!canCreateKnowledge(user, type)) {
        return res.status(403).json({ error: 'Insufficient permissions to create this type of knowledge' });
    }
    const { mimetype, buffer, originalname } = req.file;
    const cleanName = Buffer.from(originalname, 'latin1').toString('utf8');
    try {
        // Extract
        let text = '';
        if (mimetype === 'application/pdf')
            text = (await (0, pdf_parse_1.default)(buffer)).text;
        else if (mimetype === 'text/plain')
            text = buffer.toString('utf-8');
        else
            return res.status(400).json({ error: 'Unsupported file' });
        text = text.replace(/\s+/g, ' ').trim();
        if (!text)
            return res.status(400).json({ error: 'Empty text' });
        // Save Metadata
        const kb = new Knowledge({
            title: cleanName,
            type,
            contentSource: cleanName,
            ownerId: user.userId,
            department: user.department
        });
        await kb.save();
        // Process Vectors
        const chunks = chunkText(text);
        const ids = [], embeddings = [], metadatas = [], documents = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const vec = await getEmbedding(chunk);
            ids.push(`${kb._id}-${i}`);
            embeddings.push(vec);
            documents.push(chunk);
            metadatas.push({
                knowledgeId: kb._id.toString(),
                source: cleanName,
                chunkIndex: i
            });
        }
        const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION });
        await col.add({ ids, embeddings, metadatas, documents });
        res.json({ success: true, knowledge: kb });
    }
    catch (e) {
        console.error('Upload error:', e);
        res.status(500).json({ error: e.message });
    }
});
// 1.1 REQUEST PUBLISH
app.post('/api/knowledge/:id/request-publish', async (req, res) => {
    const user = extractUser(req);
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const { targetType } = req.body; // 'department' or 'public'
    try {
        const kb = await Knowledge.findById(req.params.id);
        if (!kb)
            return res.status(404).json({ error: 'Not found' });
        // Only owner can request
        if (kb.ownerId !== user.userId)
            return res.status(403).json({ error: 'Only owner can request publish' });
        // Only Personal can be promoted? Or Department to Public?
        // User rule: "student/staff ... have to create personal knowledge before request it"
        if (kb.type !== 'personal')
            return res.status(400).json({ error: 'Only personal knowledge can be requested for publishing' });
        kb.requestStatus = 'pending';
        kb.requestedType = targetType;
        await kb.save();
        res.json({ success: true, knowledge: kb });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 1.2 APPROVE PUBLISH (Admin)
app.post('/api/knowledge/:id/approve-publish', async (req, res) => {
    const user = extractUser(req);
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const { action } = req.body; // 'approve' | 'reject'
    try {
        const kb = await Knowledge.findById(req.params.id);
        if (!kb)
            return res.status(404).json({ error: 'Not found' });
        // Check Admin of SAME department
        // "student/staff may REQUEST their department admin"
        if (user.role !== 'admin')
            return res.status(403).json({ error: 'Admin only' });
        if (user.department !== kb.department)
            return res.status(403).json({ error: 'Must be admin of owner department' });
        if (action === 'approve') {
            // Logic: "Knowledge created once". We change the type.
            if (kb.requestedType) {
                kb.type = kb.requestedType;
            }
            kb.requestStatus = 'approved';
        }
        else {
            kb.requestStatus = 'rejected';
        }
        // Reset request fields if needed, or keep history? 
        // Keeping status helps UI show "Approved".
        await kb.save();
        res.json({ success: true, knowledge: kb });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 2. CREATE COLLECTION
app.post('/api/knowledge/collections', async (req, res) => {
    const user = extractUser(req);
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const { name, description, type } = req.body;
    // type: department, personal (default is system only usually, but maybe admin can create another default-like?)
    // Let's restrict: Admin -> Dept/Default. User -> Personal.
    // Validate creation permission logic
    // User requested: "Department Collection: Creatable only by admin of that department"
    // "Personal Collection: Creatable only by owner"
    let allowed = false;
    if (type === 'personal')
        allowed = true;
    else if (type === 'department' && user.role === 'admin')
        allowed = true;
    if (!allowed)
        return res.status(403).json({ error: 'Not allowed to create this collection type' });
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
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 3. MAP KNOWLEDGE TO COLLECTION
app.post('/api/knowledge/collections/:id/map', async (req, res) => {
    const user = extractUser(req);
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const { id } = req.params;
    const { knowledgeId, action } = req.body; // action: 'add' | 'remove'
    try {
        const col = await Collection.findById(id);
        const kb = await Knowledge.findById(knowledgeId);
        if (!col || !kb)
            return res.status(404).json({ error: 'Not found' });
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
            // Avoid duplicates
            if (!col.knowledgeIds.includes(kb._id)) {
                col.knowledgeIds.push(kb._id);
            }
        }
        else if (action === 'remove') {
            col.knowledgeIds = col.knowledgeIds.filter(k => k.toString() !== knowledgeId);
        }
        await col.save();
        res.json({ success: true, collection: col });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 4. LIST COLLECTIONS (For User)
app.get('/api/knowledge/collections', async (req, res) => {
    const user = extractUser(req);
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
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
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 5. GET COLLECTION DETAILS (List Knowledge inside)
app.get('/api/knowledge/collections/:id', async (req, res) => {
    const user = extractUser(req);
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        const col = await Collection.findById(req.params.id).populate('knowledgeIds');
        if (!col)
            return res.status(404).json({ error: 'Not found' });
        // Access Check
        // Dept Col: Visible only to same dept
        // Personal Col: Visible only to owner
        // Default: Visible to everyone
        let canView = false;
        if (col.type === 'default')
            canView = true;
        else if (col.type === 'department' && col.department === user.department)
            canView = true;
        else if (col.type === 'personal' && col.ownerId === user.userId)
            canView = true;
        if (!canView)
            return res.status(403).json({ error: 'Access denied' });
        res.json({ collection: col });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// 6. SEARCH (RAG)
app.post('/api/knowledge/search', async (req, res) => {
    const { query, collectionId, limit = 3 } = req.body;
    // We don't necessarily have user context here if called from Orchestrator backend-to-backend without passing headers
    // BUT the Orchestrator should ideally pass the user context headers.
    // For now, let's assume if collectionId is provided, we check logic.
    // However, Orchestrator might call this. 
    // If collectionId is missing -> SEARCH DEFAULT.
    try {
        let targetKnowledgeIds = [];
        if (collectionId) {
            const col = await Collection.findById(collectionId);
            if (col && col.knowledgeIds.length > 0) {
                targetKnowledgeIds = col.knowledgeIds.map(id => id.toString());
            }
        }
        else {
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
        const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION });
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
    }
    catch (e) {
        console.error('Search error:', e);
        res.status(500).json({ error: 'Search failed' });
    }
});
// 7. LIST KNOWLEDGE (Inventory for mapping)
app.get('/api/knowledge', async (req, res) => {
    const user = extractUser(req);
    if (!user)
        return res.status(401).json({ error: 'Unauthorized' });
    const { type } = req.query;
    try {
        const filter = {};
        if (type === 'public')
            filter.type = 'public';
        else if (type === 'department') {
            filter.type = 'department';
            filter.department = user.department;
        }
        else if (type === 'personal') {
            filter.type = 'personal';
            filter.ownerId = user.userId;
        }
        else {
            // Return all visible?
            // Or handle specific lists for UI tabs?
            // Let's support complex OR if no type specified
            filter.$or = [
                { type: 'public' },
                { type: 'department', department: user.department },
                { type: 'personal', ownerId: user.userId }
            ];
        }
        const items = await Knowledge.find(filter).sort({ createdAt: -1 });
        res.json({ knowledge: items });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// Start
app.listen(PORT, async () => {
    console.log(`[Knowledge Service] Port ${PORT} [Env: ${ENV_TYPE}]`);
    if (mongoose_1.default.connection.readyState === 1) {
        await initChroma();
        await initDefaultCollection();
    }
    else {
        mongoose_1.default.connection.once('connected', async () => {
            await initChroma();
            await initDefaultCollection();
        });
    }
});
