import mongoose, { Schema, Document } from 'mongoose';

// --- DATA MODELS ---

// 1. Knowledge (The Content)
export interface IKnowledge extends Document {
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
    processingStatus: 'none' | 'pending' | 'processing' | 'completed' | 'failed';
    processingStage: 'none' | 'uploading' | 'queued' | 'extracting' | 'extracting (OCR)' | 'chunking' | 'embedding' | 'indexing' | 'completed';
    errorReason?: string;
    s3Key?: string;
    s3Size?: number;
    textHash?: string;
    contentType?: string;
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
