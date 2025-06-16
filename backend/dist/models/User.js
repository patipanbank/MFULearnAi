"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const userSchema = new mongoose_1.default.Schema({
    nameID: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String },
    email: { type: String, required: true },
    firstName: String,
    lastName: String,
    department: String,
    role: {
        type: String,
        enum: ['Admin', 'Staffs', 'Students', 'SuperAdmin'],
        default: 'Students'
    },
    groups: [String],
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now }
});
// Add comparePassword method to the schema
userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password)
        return false;
    try {
        return await bcrypt_1.default.compare(candidatePassword, this.password);
    }
    catch (error) {
        return false;
    }
};
exports.default = mongoose_1.default.model('User', userSchema);
