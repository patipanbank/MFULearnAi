"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemPromptSchema = void 0;
const mongoose_1 = require("mongoose");
exports.SystemPromptSchema = new mongoose_1.Schema({
    prompt: { type: String, required: true },
    updatedBy: { type: String, required: true },
    updatedAt: { type: Date, default: Date.now },
});
//# sourceMappingURL=system-prompt.schema.js.map