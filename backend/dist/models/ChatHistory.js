"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatHistory = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const chatHistorySchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true, index: true },
    modelId: { type: String, required: true },
    collectionName: { type: String, required: false }, // Optional
    chatname: { type: String, required: true },
    isPinned: { type: Boolean, default: false, index: true },
    messages: [{
            id: { type: Number, required: true },
            role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
            content: { type: String, required: true, maxlength: 10000 }, // Limit content length
            timestamp: { type: Date, required: true, default: Date.now },
            images: [{
                    data: { type: String, maxlength: 5242880 }, // Limit image size to 5MB
                    mediaType: String
                }],
            sources: [{
                    modelId: String,
                    collectionName: String,
                    filename: String,
                    similarity: Number
                }]
        }],
    sources: [{
            modelId: { type: String },
            collectionName: { type: String },
            documents: [{
                    filename: { type: String },
                    similarity: { type: Number }
                }]
        }]
}, {
    timestamps: true,
    toJSON: {
        transform: function (doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});
// Add compound index for better query performance
chatHistorySchema.index({ userId: 1, isPinned: -1, updatedAt: -1 });
// Add text index for search
chatHistorySchema.index({
    chatname: 'text',
    'messages.content': 'text'
});
exports.ChatHistory = mongoose_1.default.model('ChatHistory', chatHistorySchema);
