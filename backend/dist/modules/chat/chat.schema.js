"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatSchema = exports.MessageSchema = void 0;
const mongoose_1 = require("mongoose");
exports.MessageSchema = new mongoose_1.Schema({
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    images: [{ url: String, mediaType: String }],
    timestamp: { type: Date, default: Date.now },
});
exports.ChatSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    name: { type: String, default: 'Untitled Chat' },
    agentId: { type: String },
    messages: [exports.MessageSchema],
    isPinned: { type: Boolean, default: false },
}, { timestamps: true });
//# sourceMappingURL=chat.schema.js.map