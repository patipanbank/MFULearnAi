import mongoose, { Schema, Document } from 'mongoose';

/**
 * MessageArchive — Overflow storage for sessions exceeding BSON 16MB limit.
 *
 * When a Conversation document's embedded `messages` array approaches the
 * MongoDB document size limit (~12MB threshold), older messages are moved
 * here. Each archive document holds a batch of messages from one session.
 *
 * This prevents the critical failure where MongoDB rejects writes on
 * long-running sessions with many messages or inline images/files.
 */

export interface IMessageArchive extends Document {
    userId: mongoose.Types.ObjectId;
    sessionId: string;
    /** Batch number (0 = oldest archived batch, incrementing) */
    batchIndex: number;
    /** Archived messages (oldest first) */
    messages: any[];
    /** Timestamp range for quick range queries */
    timestampRange: {
        oldest: Date;
        newest: Date;
    };
    /** Number of messages in this batch */
    messageCount: number;
    /** Approximate size in bytes when archived */
    approxSizeBytes: number;
    createdAt: Date;
}

const MessageArchiveSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    batchIndex: { type: Number, required: true, default: 0 },
    messages: [{ type: Schema.Types.Mixed }],
    timestampRange: {
        oldest: { type: Date },
        newest: { type: Date }
    },
    messageCount: { type: Number, default: 0 },
    approxSizeBytes: { type: Number, default: 0 },
    createdAt: { type: Date, default: Date.now }
});

// Compound index for efficient retrieval in order
MessageArchiveSchema.index({ userId: 1, sessionId: 1, batchIndex: 1 }, { unique: true });
// Index for timestamp-based pagination across archives
MessageArchiveSchema.index({ sessionId: 1, 'timestampRange.newest': -1 });

export const MessageArchive = mongoose.model<IMessageArchive>('MessageArchive', MessageArchiveSchema);
