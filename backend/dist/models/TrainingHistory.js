"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrainingHistory = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const trainingHistorySchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    collectionName: { type: String, required: true },
    documentName: { type: String },
    action: {
        type: String,
        enum: ['upload', 'delete', 'create_collection', 'update_collection', 'delete_collection'],
        required: true
    },
    timestamp: { type: Date, default: Date.now },
    details: { type: mongoose_1.default.Schema.Types.Mixed }
}, { timestamps: true });
const TrainingHistory = mongoose_1.default.model('TrainingHistory', trainingHistorySchema);
exports.TrainingHistory = TrainingHistory;
