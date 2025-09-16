"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrainingHistory = exports.TrainingAction = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
var TrainingAction;
(function (TrainingAction) {
    TrainingAction["UPLOAD"] = "UPLOAD";
    TrainingAction["DELETE"] = "DELETE";
    TrainingAction["UPDATE"] = "UPDATE";
})(TrainingAction || (exports.TrainingAction = TrainingAction = {}));
const trainingHistorySchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true, index: true },
    username: { type: String, required: true, index: true },
    collectionName: { type: String, required: true, index: true },
    documentName: { type: String, required: true },
    action: {
        type: String,
        enum: Object.values(TrainingAction),
        required: true
    },
    details: { type: mongoose_1.default.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now, index: true }
}, {
    timestamps: true,
    collection: 'training_history'
});
trainingHistorySchema.index({ userId: 1, timestamp: -1 });
trainingHistorySchema.index({ collectionName: 1, timestamp: -1 });
trainingHistorySchema.index({ action: 1, timestamp: -1 });
exports.TrainingHistory = mongoose_1.default.model('TrainingHistory', trainingHistorySchema);
//# sourceMappingURL=trainingHistory.js.map