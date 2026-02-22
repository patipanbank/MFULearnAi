import mongoose, { Schema, Document } from 'mongoose';

/**
 * MessageFeedback — stores user feedback (like/dislike) on AI responses.
 * Links feedback to the knowledge sources used, enabling quality analytics.
 */
export interface IMessageFeedback extends Document {
    userId: string;
    sessionId: string;
    messageIndex: number;
    type: 'liked' | 'disliked';
    /** Knowledge IDs referenced in the AI response (from RAG sources) */
    knowledgeIds: string[];
    /** The original user query that triggered this response */
    query: string;
    createdAt: Date;
}

const MessageFeedbackSchema = new Schema({
    userId: { type: String, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    messageIndex: { type: Number, required: true },
    type: { type: String, enum: ['liked', 'disliked'], required: true },
    knowledgeIds: [{ type: String }],
    query: { type: String, default: '' },
}, { timestamps: true });

// Compound index for lookup: one feedback per user per message
MessageFeedbackSchema.index({ sessionId: 1, messageIndex: 1, userId: 1 }, { unique: true });

// Index for analytics: aggregate feedback per knowledge item
MessageFeedbackSchema.index({ knowledgeIds: 1, type: 1 });

export const MessageFeedback = mongoose.model<IMessageFeedback>('MessageFeedback', MessageFeedbackSchema);
