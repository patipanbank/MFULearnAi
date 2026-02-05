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
        timestamp: { type: Date, default: Date.now }
    }],
    modelId: String,
    metadata: {
        totalTokens: { type: Number, default: 0 },
        estimatedCost: { type: Number, default: 0 },
        messageCount: { type: Number, default: 0 }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

ConversationSchema.index({ userId: 1, sessionId: 1 }, { unique: true });
export const Conversation = mongoose.model('Conversation', ConversationSchema);
