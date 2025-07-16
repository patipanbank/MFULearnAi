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
exports.TrainingHistoryService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const training_history_model_1 = require("../models/training-history.model");
let TrainingHistoryService = class TrainingHistoryService {
    trainingHistoryModel;
    constructor(trainingHistoryModel) {
        this.trainingHistoryModel = trainingHistoryModel;
    }
    async recordAction(userId, username, collectionName, documentName, action, details) {
        const historyEntry = new this.trainingHistoryModel({
            userId,
            username,
            collectionName,
            documentName,
            action,
            details,
            timestamp: new Date()
        });
        return await historyEntry.save();
    }
    async getHistoryForUser(userId, limit = 50, offset = 0) {
        return await this.trainingHistoryModel
            .find({ userId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .skip(offset)
            .exec();
    }
    async getHistoryForCollection(collectionName, limit = 50, offset = 0) {
        return await this.trainingHistoryModel
            .find({ collectionName })
            .sort({ timestamp: -1 })
            .limit(limit)
            .skip(offset)
            .exec();
    }
    async getHistoryByAction(action, limit = 50, offset = 0) {
        return await this.trainingHistoryModel
            .find({ action })
            .sort({ timestamp: -1 })
            .limit(limit)
            .skip(offset)
            .exec();
    }
    async deleteHistory(collectionName, documentName) {
        const filter = { collectionName };
        if (documentName) {
            filter.documentName = documentName;
        }
        const result = await this.trainingHistoryModel.deleteMany(filter);
        return { deletedCount: result.deletedCount || 0 };
    }
    async getStatistics(userId) {
        const filter = userId ? { userId } : {};
        const [totalActions, actionBreakdown, recentActivity] = await Promise.all([
            this.trainingHistoryModel.countDocuments(filter),
            this.getActionBreakdown(filter),
            this.trainingHistoryModel
                .find(filter)
                .sort({ timestamp: -1 })
                .limit(10)
                .exec()
        ]);
        return {
            totalActions,
            actionBreakdown,
            recentActivity
        };
    }
    async getActionBreakdown(filter) {
        const pipeline = [
            { $match: filter },
            { $group: { _id: '$action', count: { $sum: 1 } } }
        ];
        const results = await this.trainingHistoryModel.aggregate(pipeline);
        const breakdown = {
            [training_history_model_1.TrainingAction.UPLOAD]: 0,
            [training_history_model_1.TrainingAction.DELETE]: 0,
            [training_history_model_1.TrainingAction.CREATE_COLLECTION]: 0,
            [training_history_model_1.TrainingAction.UPDATE_COLLECTION]: 0,
            [training_history_model_1.TrainingAction.DELETE_COLLECTION]: 0,
        };
        results.forEach(result => {
            if (result._id in breakdown) {
                breakdown[result._id] = result.count;
            }
        });
        return breakdown;
    }
};
exports.TrainingHistoryService = TrainingHistoryService;
exports.TrainingHistoryService = TrainingHistoryService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('TrainingHistory')),
    __metadata("design:paramtypes", [mongoose_2.Model])
], TrainingHistoryService);
//# sourceMappingURL=training-history.service.js.map