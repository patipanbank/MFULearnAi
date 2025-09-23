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
exports.ConversationMessageModel = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const types_1 = require("../types");
const TokenUsageSchema = new mongoose_1.Schema({
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 }
}, { _id: false });
const ErrorDetailsSchema = new mongoose_1.Schema({
    code: { type: String, required: true },
    message: { type: String, required: true },
    details: { type: mongoose_1.Schema.Types.Mixed },
    stack: { type: String },
    timestamp: { type: Date, default: Date.now },
    retryable: { type: Boolean, default: false }
}, { _id: false });
const MessageMetadataSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    agentId: { type: String },
    modelId: { type: String },
    tokenUsage: { type: TokenUsageSchema },
    processingTime: { type: Number },
    retryCount: { type: Number, default: 0 },
    errorDetails: { type: ErrorDetailsSchema },
    sourceNode: { type: String }
}, { _id: false });
const MessageAttachmentSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    type: {
        type: String,
        enum: ['image', 'document', 'audio', 'video'],
        required: true
    },
    url: { type: String, required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    metadata: { type: mongoose_1.Schema.Types.Mixed }
}, { _id: false });
const ToolCallSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    input: { type: mongoose_1.Schema.Types.Mixed, required: true },
    output: { type: mongoose_1.Schema.Types.Mixed },
    status: {
        type: String,
        enum: ['pending', 'running', 'completed', 'failed'],
        default: 'pending'
    },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    error: { type: String }
}, { _id: false });
const ConversationMessageSchema = new mongoose_1.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    conversationId: {
        type: String,
        required: true,
        index: true
    },
    role: {
        type: String,
        enum: Object.values(types_1.MessageRole),
        required: true,
        index: true
    },
    content: {
        type: String,
        required: true,
        maxlength: 100000
    },
    status: {
        type: String,
        enum: Object.values(types_1.MessageStatus),
        default: types_1.MessageStatus.PENDING,
        index: true
    },
    metadata: {
        type: MessageMetadataSchema,
        required: true
    },
    attachments: [MessageAttachmentSchema],
    toolCalls: [ToolCallSchema],
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'conversation_messages'
});
ConversationMessageSchema.index({ conversationId: 1, createdAt: 1 });
ConversationMessageSchema.index({ conversationId: 1, role: 1 });
ConversationMessageSchema.index({ 'metadata.userId': 1, createdAt: -1 });
ConversationMessageSchema.index({ status: 1, createdAt: -1 });
ConversationMessageSchema.index({ content: 'text' });
ConversationMessageSchema.index({ createdAt: 1 }, {
    expireAfterSeconds: 7 * 24 * 60 * 60,
    partialFilterExpression: { status: types_1.MessageStatus.FAILED }
});
ConversationMessageSchema.virtual('isCompleted').get(function () {
    return this.status === types_1.MessageStatus.COMPLETED;
});
ConversationMessageSchema.virtual('isStreaming').get(function () {
    return this.status === types_1.MessageStatus.STREAMING;
});
ConversationMessageSchema.virtual('hasAttachments').get(function () {
    return this.attachments && this.attachments.length > 0;
});
ConversationMessageSchema.virtual('hasToolCalls').get(function () {
    return this.toolCalls && this.toolCalls.length > 0;
});
ConversationMessageSchema.virtual('processingTimeMs').get(function () {
    return this.metadata.processingTime ? Math.round(this.metadata.processingTime) : 0;
});
ConversationMessageSchema.methods.updateStatus = function (status, error) {
    this.status = status;
    this.updatedAt = new Date();
    if (error) {
        this.metadata.errorDetails = error;
    }
    if (status === types_1.MessageStatus.COMPLETED && this.metadata.processingTime === undefined) {
        this.metadata.processingTime = Date.now() - this.createdAt.getTime();
    }
};
ConversationMessageSchema.methods.addToolCall = function (toolCall) {
    const newToolCall = {
        id: new mongoose_1.default.Types.ObjectId().toString(),
        ...toolCall
    };
    if (!this.toolCalls) {
        this.toolCalls = [];
    }
    this.toolCalls.push(newToolCall);
    this.updatedAt = new Date();
    return newToolCall.id;
};
ConversationMessageSchema.methods.updateToolCall = function (toolCallId, updates) {
    if (!this.toolCalls)
        return false;
    const toolCall = this.toolCalls.find((tc) => tc.id === toolCallId);
    if (!toolCall)
        return false;
    Object.assign(toolCall, updates);
    this.updatedAt = new Date();
    return true;
};
ConversationMessageSchema.methods.addAttachment = function (attachment) {
    if (!this.attachments) {
        this.attachments = [];
    }
    this.attachments.push(attachment);
    this.updatedAt = new Date();
};
ConversationMessageSchema.methods.updateTokenUsage = function (tokenUsage) {
    if (!this.metadata.tokenUsage) {
        this.metadata.tokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    }
    this.metadata.tokenUsage.promptTokens += tokenUsage.promptTokens;
    this.metadata.tokenUsage.completionTokens += tokenUsage.completionTokens;
    this.metadata.tokenUsage.totalTokens += tokenUsage.totalTokens;
    this.updatedAt = new Date();
};
ConversationMessageSchema.methods.retry = function () {
    this.metadata.retryCount += 1;
    this.status = types_1.MessageStatus.PENDING;
    this.metadata.errorDetails = undefined;
    this.updatedAt = new Date();
};
ConversationMessageSchema.statics.findByConversationId = function (conversationId, options = {}) {
    const query = { conversationId };
    if (options.role) {
        query.role = options.role;
    }
    if (options.status) {
        query.status = options.status;
    }
    let queryBuilder = this.find(query)
        .sort({ createdAt: 1 })
        .limit(options.limit || 100)
        .skip(options.skip || 0);
    if (!options.includeToolCalls) {
        queryBuilder = queryBuilder.select('-toolCalls');
    }
    return queryBuilder;
};
ConversationMessageSchema.statics.findLatestByConversation = function (conversationId, limit = 10) {
    return this.find({ conversationId })
        .sort({ createdAt: -1 })
        .limit(limit);
};
ConversationMessageSchema.statics.findStreamingMessages = function () {
    return this.find({ status: types_1.MessageStatus.STREAMING })
        .sort({ createdAt: 1 });
};
ConversationMessageSchema.statics.findFailedMessages = function (retryable = true, maxRetries = 3) {
    return this.find({
        status: types_1.MessageStatus.FAILED,
        'metadata.retryCount': { $lt: maxRetries },
        'metadata.errorDetails.retryable': retryable
    }).sort({ createdAt: 1 });
};
ConversationMessageSchema.statics.getMessageStats = function (conversationId) {
    return this.aggregate([
        { $match: { conversationId } },
        {
            $group: {
                _id: null,
                totalMessages: { $sum: 1 },
                userMessages: {
                    $sum: { $cond: [{ $eq: ['$role', types_1.MessageRole.USER] }, 1, 0] }
                },
                assistantMessages: {
                    $sum: { $cond: [{ $eq: ['$role', types_1.MessageRole.ASSISTANT] }, 1, 0] }
                },
                totalTokens: { $sum: '$metadata.tokenUsage.totalTokens' },
                averageProcessingTime: { $avg: '$metadata.processingTime' },
                failedMessages: {
                    $sum: { $cond: [{ $eq: ['$status', types_1.MessageStatus.FAILED] }, 1, 0] }
                }
            }
        }
    ]);
};
ConversationMessageSchema.statics.searchContent = function (conversationId, searchQuery) {
    return this.find({
        conversationId,
        $text: { $search: searchQuery }
    }, {
        score: { $meta: 'textScore' }
    }).sort({ score: { $meta: 'textScore' } });
};
ConversationMessageSchema.pre('save', function (next) {
    if (this.isNew) {
        if (!this.id) {
            this.id = new mongoose_1.default.Types.ObjectId().toString();
        }
    }
    this.updatedAt = new Date();
    next();
});
ConversationMessageSchema.post('save', function (doc) {
    console.log(`💬 Message saved: ${doc.id} (${doc.role}) in conversation ${doc.conversationId}`);
});
exports.ConversationMessageModel = mongoose_1.default.model('ConversationMessage', ConversationMessageSchema);
//# sourceMappingURL=ConversationMessage.js.map