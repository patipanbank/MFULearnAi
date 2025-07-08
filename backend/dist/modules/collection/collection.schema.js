"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CollectionSchema = void 0;
const mongoose_1 = require("mongoose");
const collection_permission_enum_1 = require("./collection-permission.enum");
exports.CollectionSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true },
    permission: { type: String, enum: Object.values(collection_permission_enum_1.CollectionPermission), required: true },
    createdBy: { type: String, required: true },
    department: { type: String },
    modelId: { type: String },
}, { timestamps: true });
//# sourceMappingURL=collection.schema.js.map