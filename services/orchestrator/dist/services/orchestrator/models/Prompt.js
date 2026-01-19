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
const mongoose_1 = __importStar(require("mongoose"));
const PromptVersionSchema = new mongoose_1.Schema({
    version: { type: Number, required: true },
    content: { type: String, required: true },
    variables: [{ type: String }],
    changelog: { type: String },
    createdBy: { type: String },
    createdAt: { type: Date, default: Date.now },
    modelConfig: {
        modelId: String,
        temperature: Number
    }
});
const PromptSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['core', 'scenario'], required: true, index: true },
    ownerId: { type: String, index: true }, // Index for fast lookup of user's prompts
    name: { type: String, required: true },
    description: { type: String },
    tags: [{ type: String }],
    isPublic: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false }, // Only useful for Core prompts
    config: {
        modelId: String,
        temperature: Number
    },
    versions: [PromptVersionSchema],
    activeVersion: { type: Number, default: 1 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
// Compound index to help searching "My prompts OR Public prompts"
PromptSchema.index({ ownerId: 1, isPublic: 1 });
PromptSchema.index({ type: 1, isActive: 1 }); // Fast find active core prompt
exports.default = mongoose_1.default.model('Prompt', PromptSchema);
