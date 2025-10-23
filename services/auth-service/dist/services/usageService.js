"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usageService = exports.UsageService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const user_1 = require("../models/user");
// Define Usage Schema
const UsageSchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true, unique: true },
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    chatCount: { type: Number, default: 0 },
    dailyUsage: {
        date: { type: String, default: () => new Date().toISOString().split('T')[0] },
        inputTokens: { type: Number, default: 0 },
        outputTokens: { type: Number, default: 0 },
        totalTokens: { type: Number, default: 0 }
    },
    lastUsed: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});
const UsageModel = mongoose_1.default.model('Usage', UsageSchema);
class UsageService {
    constructor() {
        console.log('✅ Usage service initialized');
    }
    async checkQuotaAndUsage(userId, inputTokens, outputTokens) {
        const user = await user_1.User.findById(userId);
        if (!user) {
            return { canUse: false, reason: 'User not found' };
        }
        const usage = await this.getUserUsage(userId);
        const totalNewTokens = inputTokens + outputTokens;
        const today = new Date().toISOString().split('T')[0];
        // Check if user exceeds total quota
        if (user.tokenQuota && usage && (usage.totalTokens + totalNewTokens) > user.tokenQuota) {
            return { canUse: false, reason: 'Token quota exceeded', usage };
        }
        // Check daily limit
        if (user.dailyTokenLimit && usage?.dailyUsage) {
            const dailyTotal = usage.dailyUsage.date === today
                ? usage.dailyUsage.totalTokens + totalNewTokens
                : totalNewTokens;
            if (dailyTotal > user.dailyTokenLimit) {
                return { canUse: false, reason: 'Daily token limit exceeded', usage };
            }
        }
        return { canUse: true, usage: usage || undefined };
    }
    async updateUsage(userId, inputTokens, outputTokens) {
        const quotaCheck = await this.checkQuotaAndUsage(userId, inputTokens, outputTokens);
        if (!quotaCheck.canUse) {
            console.log(`⚠️ Usage blocked for user ${userId}: ${quotaCheck.reason}`);
            return { success: false, reason: quotaCheck.reason };
        }
        const totalTokens = inputTokens + outputTokens;
        const now = new Date();
        const today = new Date().toISOString().split('T')[0];
        await UsageModel.findOneAndUpdate({ userId }, {
            $inc: {
                inputTokens,
                outputTokens,
                totalTokens,
                chatCount: 1,
                [`dailyUsage.inputTokens`]: inputTokens,
                [`dailyUsage.outputTokens`]: outputTokens,
                [`dailyUsage.totalTokens`]: totalTokens,
            },
            $set: {
                [`dailyUsage.date`]: today,
                lastUsed: now,
                updatedAt: now
            },
            $setOnInsert: {
                createdAt: now
            }
        }, { upsert: true, new: true });
        // Reset daily usage if it's a new day
        const usage = await UsageModel.findOne({ userId });
        if (usage?.dailyUsage?.date !== today) {
            await UsageModel.findOneAndUpdate({ userId }, {
                $set: {
                    'dailyUsage.date': today,
                    'dailyUsage.inputTokens': inputTokens,
                    'dailyUsage.outputTokens': outputTokens,
                    'dailyUsage.totalTokens': totalTokens
                }
            });
        }
        console.log(`📊 Updated usage for user ${userId}: +${inputTokens} input, +${outputTokens} output tokens`);
        return { success: true };
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
        const today = new Date().toISOString().split('T')[0];
        await UsageModel.findOneAndUpdate({ userId }, {
            $set: {
                inputTokens: 0,
                outputTokens: 0,
                totalTokens: 0,
                chatCount: 0,
                'dailyUsage.date': today,
                'dailyUsage.inputTokens': 0,
                'dailyUsage.outputTokens': 0,
                'dailyUsage.totalTokens': 0,
                updatedAt: new Date()
            }
        });
        console.log(`🔄 Reset usage for user ${userId}`);
    }
    async getUserQuotaInfo(userId) {
        const user = await user_1.User.findById(new mongoose_1.default.Types.ObjectId(userId)).select('tokenQuota dailyTokenLimit');
        console.log(`🔍 getUserQuotaInfo - userId: ${userId}, user found:`, !!user);
        const usage = await this.getUserUsage(userId);
        const today = new Date().toISOString().split('T')[0];
        const remainingQuota = user?.tokenQuota ? user.tokenQuota - (usage?.totalTokens || 0) : undefined;
        let remainingDaily = undefined;
        if (user?.dailyTokenLimit && usage?.dailyUsage) {
            const dailyUsed = usage.dailyUsage.date === today ? usage.dailyUsage.totalTokens : 0;
            remainingDaily = user.dailyTokenLimit - dailyUsed;
        }
        else if (user?.dailyTokenLimit) {
            remainingDaily = user.dailyTokenLimit;
        }
        return {
            user: user ? { tokenQuota: user.tokenQuota, dailyTokenLimit: user.dailyTokenLimit } : null,
            usage,
            remainingQuota,
            remainingDaily
        };
    }
    async updateUserQuota(userId, tokenQuota, dailyTokenLimit) {
        const updateFields = {};
        if (tokenQuota !== undefined)
            updateFields.tokenQuota = tokenQuota;
        if (dailyTokenLimit !== undefined)
            updateFields.dailyTokenLimit = dailyTokenLimit;
        await user_1.User.findByIdAndUpdate(userId, { $set: updateFields });
        console.log(`📝 Updated quota for user ${userId}: ${JSON.stringify(updateFields)}`);
    }
}
exports.UsageService = UsageService;
exports.usageService = new UsageService();
//# sourceMappingURL=usageService.js.map