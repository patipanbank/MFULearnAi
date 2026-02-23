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
    visibility: 'active' | 'archived';
    requestStatus: 'none' | 'pending' | 'approved' | 'rejected';
    requestedType?: 'public' | 'department' | 'policy';
    content?: string; // Store full text content
    createdAt: Date;
    processingStatus: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
    processingStage: 'none' | 'uploading' | 'queued' | 'extracting' | 'extracting (OCR)' | 'chunking' | 'embedding' | 'indexing' | 'completed' | 'failed';
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
}

const KnowledgeSchema = new Schema({
    title: { type: String, required: true },
    description: String,
    type: { type: String, enum: ['public', 'department', 'personal', 'policy'], required: true },
    contentSource: String,
    content: String, // New field
    ownerId: { type: String, required: true },
    department: { type: String, required: true },
    visibility: { type: String, default: 'active' },
    requestStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    requestedType: { type: String, enum: ['public', 'department', 'policy'] },
    // Async Processing Fields
    processingStatus: { type: String, enum: ['none', 'pending', 'processing', 'completed', 'failed'], default: 'none' },
    processingStage: { type: String, enum: ['none', 'uploading', 'queued', 'extracting', 'extracting (OCR)', 'chunking', 'embedding', 'indexing', 'completed', 'failed'], default: 'none' },
    s3Key: String,
    s3Size: Number, // File size in bytes
    textHash: String, // SHA256 of extracted text
    errorReason: String,
    contentType: String,
    version: { type: Number, default: 1 },
    previousVersionId: { type: Schema.Types.ObjectId, ref: 'Knowledge' },
    folder: { type: String, default: '' }, // e.g. "HR/Policies"
    expiresAt: { type: Date }, // Auto-expiry / Review Cycle target date
    tags: { type: [String], default: [], index: true }
}, { timestamps: true });

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
