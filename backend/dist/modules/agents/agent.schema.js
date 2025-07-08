"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentSchema = void 0;
const mongoose_1 = require("mongoose");
exports.AgentSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    description: { type: String },
    systemPrompt: { type: String, required: true },
    modelId: { type: String, required: true },
    collectionNames: [{ type: String }],
    temperature: { type: Number, default: 0.7 },
    maxTokens: { type: Number, default: 4000 },
    isPublic: { type: Boolean, default: false },
    tags: [{ type: String }],
    createdBy: { type: String },
}, { timestamps: true });
//# sourceMappingURL=agent.schema.js.map