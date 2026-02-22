import mongoose, { Schema, Document } from 'mongoose';

/**
 * KnowledgeHit — logs every time a knowledge document is retrieved via RAG search.
 * Powers usage analytics: most-used docs, unused docs, per-doc hit details.
 */
export interface IKnowledgeHit extends Document {
    knowledgeId: string;
    query: string;
    score: number;
    userId: string;
    toolName: string;
    createdAt: Date;
}

const KnowledgeHitSchema = new Schema({
    knowledgeId: { type: String, required: true, index: true },
    query: { type: String, required: true },
    score: { type: Number, required: true },
    userId: { type: String, required: true },
    toolName: { type: String, default: 'search' },
}, { timestamps: true });

// For "top docs this week" queries
KnowledgeHitSchema.index({ createdAt: -1 });

// For per-document analytics
KnowledgeHitSchema.index({ knowledgeId: 1, createdAt: -1 });

// TTL: auto-delete hits older than 90 days to prevent unbounded growth
KnowledgeHitSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const KnowledgeHit = mongoose.model<IKnowledgeHit>('KnowledgeHit', KnowledgeHitSchema);
