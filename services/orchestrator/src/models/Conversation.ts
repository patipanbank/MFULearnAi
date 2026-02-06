import mongoose from 'mongoose';

const ConversationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    sessionId: { type: String, required: true, index: true },
    environment: { type: String, enum: ['TEST', 'PROD'], required: true },
    messages: [{
        role: { type: String, enum: ['user', 'assistant', 'system'] },
        content: String,
        images: [{
            data: String,
            mediaType: String
        }],
        files: [{
            name: String,
            content: String,
            size: Number,
            mediaType: String
        }],
        timestamp: { type: Date, default: Date.now },
        meta: { type: mongoose.Schema.Types.Mixed }
    }],
    modelId: String,
    metadata: {
        totalTokens: { type: Number, default: 0 },
        estimatedCost: { type: Number, default: 0 },
        messageCount: { type: Number, default: 0 },
        title: { type: String, default: '' }
    },
    summary: { type: String, default: '' }, // Legacy Summary (Deprecated)

    // Smart Context V2
    smartContext: {
        canonical: { type: String, default: '' }, // Long-term stable truth (Append-only conceptually)
        rolling: {
            facts: [String],
            intent: String,
            constraints: [String],
            decisions: [String],
            open_questions: [String]
        },
        version: { type: Number, default: 0 },
        hashes: {
            canonical: String,
            rolling: String,
            raw: String // Hash of raw messages at time of summarization
        },
        lastCanonizedAt: { type: Date, default: Date.now }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Index for fast retrieval / cleanup
ConversationSchema.index({ userId: 1, sessionId: 1 });
ConversationSchema.index({ updatedAt: -1 });

export const Conversation = mongoose.model('Conversation', ConversationSchema);
