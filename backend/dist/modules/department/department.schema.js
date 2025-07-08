"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DepartmentSchema = void 0;
const mongoose_1 = require("mongoose");
exports.DepartmentSchema = new mongoose_1.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
}, { timestamps: true });
exports.DepartmentSchema.pre('save', function (next) {
    this.name = this.name.toLowerCase().trim();
    next();
});
//# sourceMappingURL=department.schema.js.map