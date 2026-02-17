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
        meta: { type: mongoose.Schema.Types.Mixed },
        // Agent event flow timeline — persisted for inspection/debugging
        agentEvents: [{
            type: { type: String },             // event type (agent_start, thinking, tool_start, etc.)
            step: Number,                        // agent loop step number
            toolName: String,                    // tool name (for tool_start/tool_complete)
            input: mongoose.Schema.Types.Mixed,  // tool input
            resultPreview: String,               // truncated tool result
            success: Boolean,                    // tool execution success
            durationMs: Number,                  // duration of step/tool execution
            message: String,                     // status/thinking message
            answerMode: String,                  // answer mode (internal/rag/file_grounded)
            totalSteps: Number,                  // total steps at completion
            totalTokens: Number,                 // total tokens at completion
            tokens: mongoose.Schema.Types.Mixed, // per-step token usage {input, output, total}
            timestamp: { type: Date, default: Date.now }
        }]
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
