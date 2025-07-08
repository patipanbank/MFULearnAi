"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatsService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
let StatsService = class StatsService {
    constructor(chatModel, userModel, statsModel) {
        this.chatModel = chatModel;
        this.userModel = userModel;
        this.statsModel = statsModel;
    }
    async getTotalStats() {
        const totalUsers = await this.userModel.countDocuments();
        const totalChats = await this.chatModel.countDocuments();
        const agg = await this.statsModel.aggregate([
            {
                $group: {
                    _id: null,
                    tokens: { $sum: { $ifNull: ['$totalTokens', 0] } },
                },
            },
        ]);
        const totalTokens = agg.length ? agg[0].tokens : 0;
        return { totalUsers, totalChats, totalTokens };
    }
    async getDailyChatStats() {
        const now = new Date();
        const startOfDay = new Date(now.getTime());
        startOfDay.setUTCHours(0 - 7, 0, 0, 0);
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
        const dailyChats = await this.chatModel.countDocuments({
            createdAt: { $gte: startOfDay, $lt: endOfDay },
        });
        return {
            date: now.toISOString().split('T')[0],
            totalChatsToday: dailyChats,
        };
    }
    async getDailyStats(startDate, endDate) {
        const query = {};
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            end.setUTCHours(23, 59, 59, 999);
            query.date = { $gte: start, $lte: end };
        }
        const stats = await this.statsModel.find(query).sort({ date: -1 }).lean();
        return stats.map((s) => {
            var _a;
            return ({
                date: s.date,
                uniqueUsers: s.uniqueUsers.length,
                totalChats: s.totalChats,
                totalTokens: (_a = s.totalTokens) !== null && _a !== void 0 ? _a : 0,
            });
        });
    }
};
exports.StatsService = StatsService;
exports.StatsService = StatsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('Chat')),
    __param(1, (0, mongoose_1.InjectModel)('User')),
    __param(2, (0, mongoose_1.InjectModel)('ChatStats')),
    __metadata("design:paramtypes", [mongoose_2.Model,
        mongoose_2.Model,
        mongoose_2.Model])
], StatsService);
//# sourceMappingURL=stats.service.js.map