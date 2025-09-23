"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const types_1 = require("../types");
const MemorySettingsSchema = new mongoose_1.Schema({
    shortTermEnabled: { type: Boolean, default: true },
    longTermEnabled: { type: Boolean, default: true },
    embeddingEnabled: { type: Boolean, default: true },
    maxShortTermMessages: { type: Number, default: 10 },
    embeddingThreshold: { type: Number, default: 10 },
    contextWindow: { type: Number, default: 4000 }
}, { _id: false });
const ConversationConfigurationSchema = new mongoose_1.Schema({
    temperature: { type: Number, default: 0.7, min: 0, max: 2 },
    maxTokens: { type: Number, default: 4000, min: 1, max: 200000 },
    collectionNames: [{ type: String }],
    enabledTools: [{ type: String }],
    memorySettings: { type: MemorySettingsSchema, default: () => ({}) },
    streamingEnabled: { type: Boolean, default: true },
    autoSave: { type: Boolean, default: true },
    timeoutMs: { type: Number, default: 60000 }
}, { _id: false });
const ConversationMetadataSchema = new mongoose_1.Schema({
    messageCount: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    lastError: {
        code: String,
        message: String,
        details: mongoose_1.Schema.Types.Mixed,
        timestamp: Date,
        retryable: Boolean
    },
    tags: [{ type: String }],
    isPinned: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false }
}, { _id: false });
const ConversationSchema = new mongoose_1.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    status: {
        type: String,
        enum: Object.values(types_1.ConversationStatus),
        default: types_1.ConversationStatus.ACTIVE,
        index: true
    },
    agentId: {
        type: String,
        index: true
    },
    modelId: {
        type: String,
        required: true,
        default: 'anthropic.claude-3-5-sonnet-20240620-v1:0'
    },
    systemPrompt: {
        type: String,
        maxlength: 10000
    },
    configuration: {
        type: ConversationConfigurationSchema,
        default: () => ({})
    },
    metadata: {
        type: ConversationMetadataSchema,
        default: () => ({})
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    lastMessageAt: {
        type: Date,
        index: true
    }
}, {
    timestamps: true,
    collection: 'conversations'
});
ConversationSchema.index({ userId: 1, createdAt: -1 });
ConversationSchema.index({ userId: 1, status: 1 });
ConversationSchema.index({ userId: 1, 'metadata.isPinned': 1 });
ConversationSchema.index({ userId: 1, lastMessageAt: -1 });
ConversationSchema.index({ status: 1, updatedAt: -1 });
ConversationSchema.index({
    title: 'text',
    systemPrompt: 'text',
    'metadata.tags': 'text'
});
ConversationSchema.index({ updatedAt: 1 }, {
    expireAfterSeconds: 365 * 24 * 60 * 60,
    partialFilterExpression: { 'metadata.isArchived': true }
});
ConversationSchema.virtual('isActive').get(function () {
    return this.status === types_1.ConversationStatus.ACTIVE;
});
ConversationSchema.virtual('hasMessages').get(function () {
    return this.metadata.messageCount > 0;
});
ConversationSchema.virtual('responseTimeMs').get(function () {
    return Math.round(this.metadata.averageResponseTime);
});
ConversationSchema.methods.updateStats = function (stats) {
    if (stats.messageCount !== undefined) {
        this.metadata.messageCount = stats.messageCount;
    }
    if (stats.tokenUsage !== undefined) {
        this.metadata.totalTokens += stats.tokenUsage;
    }
    if (stats.responseTime !== undefined) {
        const currentAvg = this.metadata.averageResponseTime || 0;
        const messageCount = this.metadata.messageCount || 1;
        this.metadata.averageResponseTime =
            (currentAvg * (messageCount - 1) + stats.responseTime) / messageCount;
    }
    if (stats.errorOccurred) {
        this.metadata.errorCount += 1;
    }
    this.updatedAt = new Date();
    this.lastMessageAt = new Date();
};
ConversationSchema.methods.setError = function (error) {
    this.metadata.lastError = {
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: new Date(),
        retryable: error.retryable || false
    };
    this.metadata.errorCount += 1;
    this.updatedAt = new Date();
};
ConversationSchema.methods.clearError = function () {
    this.metadata.lastError = undefined;
    this.updatedAt = new Date();
};
ConversationSchema.methods.archive = function () {
    this.status = types_1.ConversationStatus.ARCHIVED;
    this.metadata.isArchived = true;
    this.updatedAt = new Date();
};
ConversationSchema.methods.pin = function () {
    this.metadata.isPinned = true;
    this.updatedAt = new Date();
};
ConversationSchema.methods.unpin = function () {
    this.metadata.isPinned = false;
    this.updatedAt = new Date();
};
ConversationSchema.statics.findByUserId = function (userId, options = {}) {
    const query = { userId };
    if (options.status) {
        query.status = options.status;
    }
    if (options.isPinned !== undefined) {
        query['metadata.isPinned'] = options.isPinned;
    }
    return this.find(query)
        .sort({ 'metadata.isPinned': -1, lastMessageAt: -1, createdAt: -1 })
        .limit(options.limit || 50)
        .skip(options.skip || 0);
};
ConversationSchema.statics.findActiveByUser = function (userId) {
    return this.find({
        userId,
        status: types_1.ConversationStatus.ACTIVE,
        'metadata.isArchived': { $ne: true }
    }).sort({ lastMessageAt: -1 });
};
ConversationSchema.statics.searchConversations = function (userId, searchQuery) {
    return this.find({
        userId,
        $text: { $search: searchQuery }
    }, {
        score: { $meta: 'textScore' }
    }).sort({ score: { $meta: 'textScore' } });
};
ConversationSchema.statics.getStatsByUser = function (userId) {
    return this.aggregate([
        { $match: { userId } },
        {
            $group: {
                _id: null,
                totalConversations: { $sum: 1 },
                activeConversations: {
                    $sum: { $cond: [{ $eq: ['$status', types_1.ConversationStatus.ACTIVE] }, 1, 0] }
                },
                totalMessages: { $sum: '$metadata.messageCount' },
                totalTokens: { $sum: '$metadata.totalTokens' },
                averageResponseTime: { $avg: '$metadata.averageResponseTime' }
            }
        }
    ]);
};
ConversationSchema.pre('save', function (next) {
    if (this.isNew) {
        if (!this.id) {
            this.id = new mongoose_1.default.Types.ObjectId().toString();
        }
    }
    this.updatedAt = new Date();
    next();
});
ConversationSchema.post('save', function (doc) {
    console.log(`💾 Conversation saved: ${doc.id} (${doc.title})`);
});
exports.ConversationModel = mongoose_1.default.model('Conversation', ConversationSchema);
//# sourceMappingURL=Conversation.js.map