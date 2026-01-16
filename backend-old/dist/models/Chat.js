"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Chat = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mongoose_2 = require("mongoose");
const chatSchema = new mongoose_1.default.Schema({
    userId: {
        type: String,
        required: true,
    },
    chatname: {
        type: String,
        default: 'Untitled Chat'
    },
    name: {
        type: String,
        required: true,
    },
    messages: {
        type: [{
                id: mongoose_2.Schema.Types.Mixed,
                role: String,
                content: String,
                timestamp: { type: Date, default: Date.now },
                images: [{
                        data: String,
                        mediaType: String
                    }],
                files: [{
                        name: String,
                        data: String,
                        mediaType: String,
                        size: Number
                    }],
                sources: [{
                        modelId: String,
                        collectionName: String,
                        filename: String,
                        similarity: Number
                    }],
                isImageGeneration: Boolean,
                isComplete: Boolean,
                isEdited: Boolean
            }],
        required: true,
        validate: {
            validator: function (messages) {
                return messages.length > 0;
            },
            message: 'Messages array cannot be empty'
        }
    },
    modelId: {
        type: String,
        required: true,
    },
    isPinned: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});
chatSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});
exports.Chat = mongoose_1.default.model('Chat', chatSchema);
