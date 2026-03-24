import mongoose, { Schema, Document } from 'mongoose';

// --- DATA MODELS ---

// 1. Knowledge (The Content)
export interface IKnowledge extends Document {
    title: string;
    description?: string;
    type: 'public' | 'department' | 'personal' | 'policy';
    contentSource: string; // Filename for now
    ownerId: string;
    department: string;
    visibility: 'active' | 'archived' | 'deleted';
    requestStatus: 'none' | 'pending' | 'approved' | 'rejected';
    requestedType?: 'public' | 'department' | 'policy';
    content?: string; // Store full text content
    createdAt: Date;
    updatedAt: Date;
    processingStatus: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
    processingStage: 'none' | 'uploading' | 'queued' | 'extracting' | 'extracting (OCR)' | 'chunking' | 'embedding' | 'indexing' | 'completed' | 'failed';
    processingMessage?: string; // e.g. "Page 3 of 10"
    errorReason?: string;
    s3Key?: string;
    s3Size?: number;
    textHash?: string;
    contentType?: string;
    version: number;
    previousVersionId?: string;
    folder?: string;
    expiresAt?: Date;
    tags: string[];
    // Enterprise: Audit trail
    lastModifiedBy?: string;
    uploadIp?: string;
    processingRetryCount: number;
    processingDuration?: number; // ms from queued to completed
    chunkCount?: number;
    // Enterprise: File integrity
    originalFileHash?: string; // SHA256 of the original uploaded file
    detectedMimeType?: string; // Magic-bytes detected MIME (vs client-declared)
    // Structured data support (dual-path: JSON lookup vs vector search)
    dataFormat?: 'structured' | 'unstructured' | 'hybrid';
    structuredData?: Array<Record<string, unknown>>; // Parsed rows as JSON
    structuredMeta?: {
        headers: string[];           // Column names
        rowCount: number;
        colCount: number;
        totalChars: number;          // Total character count across all cells
        sheetNames?: string[];       // Source sheet tab names
        keyColumns?: string[];       // Auto-detected key columns (low-cardinality/unique)
    };
}

const KnowledgeSchema = new Schema({
    title: { type: String, required: true, maxlength: 500 },
    description: { type: String, maxlength: 5000 },
    type: { type: String, enum: ['public', 'department', 'personal', 'policy'], required: true },
    contentSource: String,
    content: String,
    ownerId: { type: String, required: true },
    department: { type: String, required: true },
    visibility: { type: String, enum: ['active', 'archived', 'deleted'], default: 'active' },
    requestStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    requestedType: { type: String, enum: ['public', 'department', 'policy'] },
    // Async Processing Fields
    processingStatus: { type: String, enum: ['none', 'pending', 'processing', 'completed', 'failed'], default: 'none' },
    processingStage: { type: String, enum: ['none', 'uploading', 'queued', 'extracting', 'extracting (OCR)', 'chunking', 'embedding', 'indexing', 'completed', 'failed'], default: 'none' },
    processingMessage: String,
    s3Key: String,
    s3Size: Number,
    textHash: { type: String, index: true },
    errorReason: String,
    contentType: String,
    version: { type: Number, default: 1 },
    previousVersionId: { type: Schema.Types.ObjectId, ref: 'Knowledge' },
    folder: { type: String, default: '' },
    expiresAt: { type: Date },
    tags: { type: [String], default: [], index: true },
    // Enterprise: Audit trail
    lastModifiedBy: String,
    uploadIp: String,
    processingRetryCount: { type: Number, default: 0 },
    processingDuration: Number,
    chunkCount: Number,
    // Enterprise: File integrity
    originalFileHash: String,
    detectedMimeType: String,
    // Structured data (dual-path knowledge)
    dataFormat: { type: String, enum: ['structured', 'unstructured', 'hybrid'], default: 'unstructured' },
    structuredData: { type: Schema.Types.Mixed }, // JSON array of row objects
    structuredMeta: {
        headers: [String],
        rowCount: Number,
        colCount: Number,
        totalChars: Number,
        sheetNames: [String],
        keyColumns: [String]
    }
}, { timestamps: true });

// ── Enterprise Indexes ──
// Core query patterns
KnowledgeSchema.index({ ownerId: 1, visibility: 1, type: 1 });
KnowledgeSchema.index({ department: 1, visibility: 1, type: 1 });
KnowledgeSchema.index({ type: 1, visibility: 1 });
KnowledgeSchema.index({ processingStatus: 1 });
KnowledgeSchema.index({ requestStatus: 1, department: 1 });
// Versioning lookup
KnowledgeSchema.index({ title: 1, type: 1, ownerId: 1, department: 1, visibility: 1 });
// Expiry management
KnowledgeSchema.index({ expiresAt: 1 }, { sparse: true });
// Structured data lookup
KnowledgeSchema.index({ dataFormat: 1, ownerId: 1, visibility: 1 });
// Full-text search fallback
KnowledgeSchema.index({ title: 'text', description: 'text', folder: 'text' });

export const Knowledge = mongoose.model<IKnowledge>('Knowledge', KnowledgeSchema);

// 2. Collection (The Grouping)
export interface ICollection extends Document {
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

export const Collection = mongoose.model<ICollection>('Collection', CollectionSchema);
