"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelModel = void 0;
const mongoose_1 = require("mongoose");
const modelSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    collections: [{ type: String }],
    createdBy: { type: String, required: true },
    modelType: { type: String, enum: ['official', 'personal', 'department'], required: true },
    department: { type: String },
}, { timestamps: true });
exports.ModelModel = (0, mongoose_1.model)('Model', modelSchema);
