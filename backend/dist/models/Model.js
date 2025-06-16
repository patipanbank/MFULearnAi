"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelModel = void 0;
const mongoose_1 = require("mongoose");
const modelSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    collections: [{
            name: { type: String, required: true },
            description: { type: String, required: true }
        }],
    createdBy: { type: String, required: true },
    modelType: { type: String, enum: ['official', 'personal', 'department'], required: true },
    department: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Department' },
    isAgent: { type: Boolean, default: false },
    prompt: { type: String, default: '' },
    displayRetrievedChunks: { type: Boolean, default: true },
    is_public: { type: Boolean, default: false },
    user: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User' },
    system_prompt: { type: String, default: null },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });
exports.ModelModel = (0, mongoose_1.model)('Model', modelSchema);
