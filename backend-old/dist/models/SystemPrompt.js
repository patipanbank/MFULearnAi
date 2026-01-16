"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemPrompt = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const systemPromptSchema = new mongoose_1.default.Schema({
    prompt: {
        type: String,
        required: true,
    },
    updatedBy: {
        type: String,
        required: true,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    }
});
exports.SystemPrompt = mongoose_1.default.model('SystemPrompt', systemPromptSchema);
