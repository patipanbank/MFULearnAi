"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usageService = exports.UsageService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const UsageSchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true, unique: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    chatCount: { type: Number, default: 0 },
    lastUsed: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
const UsageModel = mongoose_1.default.model('Usage', UsageSchema);
class UsageService {
    constructor() {
        console.log('✅ Usage service initialized');
    }
    async updateUsage(userId, inputTokens, outputTokens) {
        const totalTokens = inputTokens + outputTokens;
        const now = new Date();
        await UsageModel.findOneAndUpdate({ userId }, {
            $inc: {
                inputTokens,
                outputTokens,
                totalTokens,
                chatCount: 1
            },
            $set: {
                lastUsed: now,
                updatedAt: now
            },
            $setOnInsert: {
                createdAt: now
            }
        }, { upsert: true, new: true });
        console.log(`📊 Updated usage for user ${userId}: +${inputTokens} input, +${outputTokens} output tokens`);
    }
    async getUserUsage(userId) {
        const usage = await UsageModel.findOne({ userId });
        return usage;
    }
    async getTotalUsage() {
        const result = await UsageModel.aggregate([
            {
                $group: {
                    _id: null,
                    totalInputTokens: { $sum: '$inputTokens' },
                    totalOutputTokens: { $sum: '$outputTokens' },
                    totalTokens: { $sum: '$totalTokens' },
                    totalChats: { $sum: '$chatCount' },
                    activeUsers: { $sum: 1 }
                }
            }
        ]);
        if (result.length === 0) {
            return {
                totalInputTokens: 0,
                totalOutputTokens: 0,
                totalTokens: 0,
                totalChats: 0,
                activeUsers: 0
            };
        }
        return result[0];
    }
    async resetUserUsage(userId) {
        await UsageModel.findOneAndUpdate({ userId }, {
            $set: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                chatCount: 0,
                updatedAt: new Date()
            }
        });
        console.log(`🔄 Reset usage for user ${userId}`);
    }
}
exports.UsageService = UsageService;
exports.usageService = new UsageService();
//# sourceMappingURL=usageService.js.map