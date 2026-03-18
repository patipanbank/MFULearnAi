import mongoose, { Schema, Document } from 'mongoose';

/**
 * UserMemory — Cross-session persistent memory per user.
 *
 * Stores facts, preferences, and context that span ALL conversations.
 * Unlike SmartContext (per-session), this is a global knowledge store
 * about the user that persists indefinitely.
 *
 * Use cases:
 *   - "Remember I'm a 3rd year IT student"
 *   - "I prefer answers in Thai"
 *   - Accumulated expertise level tracking
 *   - Cross-session project continuity
 *
 * Design:
 *   - Facts are categorized (preference, biographical, project, etc.)
 *   - Each fact has a source (auto-extracted vs explicit user instruction)
 *   - Facts can be confirmed, tentative, or archived
 *   - Maximum facts limit prevents unbounded growth
 */

export interface IUserMemoryFact {
    id: string;
    content: string;
    category: 'preference' | 'biographical' | 'project' | 'expertise' | 'instruction' | 'other';
    source: 'explicit' | 'inferred' | 'corrected';
    status: 'active' | 'tentative' | 'archived';
    confidence: number; // 0-1
    createdAt: Date;
    updatedAt: Date;
    sourceSessionId?: string;
    /** Number of sessions where this fact was relevant */
    hitCount: number;
}

export interface IUserMemory extends Document {
    userId: string;
    facts: IUserMemoryFact[];
    /** Compact text summary for injection into prompts */
    summary: string;
    /** Max facts before auto-archival triggers */
    maxFacts: number;
    version: number;
    lastAccessedAt: Date;
    createdAt: Date;
    updatedAt: Date;
}

const UserMemoryFactSchema = new Schema({
    id: { type: String, required: true },
    content: { type: String, required: true },
    category: {
        type: String,
        enum: ['preference', 'biographical', 'project', 'expertise', 'instruction', 'other'],
        default: 'other'
    },
    source: {
        type: String,
        enum: ['explicit', 'inferred', 'corrected'],
        default: 'inferred'
    },
    status: {
        type: String,
        enum: ['active', 'tentative', 'archived'],
        default: 'tentative'
    },
    confidence: { type: Number, default: 0.5, min: 0, max: 1 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    sourceSessionId: String,
    hitCount: { type: Number, default: 0 }
}, { _id: false });

const UserMemorySchema = new Schema({
    userId: { type: String, required: true, unique: true, index: true },
    facts: [UserMemoryFactSchema],
    summary: { type: String, default: '' },
    maxFacts: { type: Number, default: 50 },
    version: { type: Number, default: 0 },
    lastAccessedAt: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export const UserMemory = mongoose.model<IUserMemory>('UserMemory', UserMemorySchema);
