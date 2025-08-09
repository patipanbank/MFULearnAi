"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trainingHistoryService = exports.TrainingHistoryService = void 0;
const trainingHistory_1 = require("../models/trainingHistory");
class TrainingHistoryService {
    constructor() {
        console.log('✅ Training History service initialized');
    }
    async recordAction(userId, username, collectionName, documentName, action, details = {}) {
        try {
            const historyRecord = new trainingHistory_1.TrainingHistory({
                userId,
                username,
                collectionName,
                documentName,
                action,
                details,
                timestamp: new Date()
            });
            const savedRecord = await historyRecord.save();
            console.log(`📝 Training history recorded: ${action} for ${documentName} in ${collectionName} by ${username}`);
            return savedRecord;
        }
        catch (error) {
            console.error('❌ Error recording training history:', error);
            throw error;
        }
    }
    async recordFileUpload(user, collectionName, fileName, fileSize, chunksAdded, modelId) {
        return this.recordAction(user._id?.toString() || 'unknown', user.username, collectionName, fileName, trainingHistory_1.TrainingAction.UPLOAD, {
            modelId,
            chunks_added: chunksAdded,
            source_type: 'file',
            file_size: fileSize
        });
    }
    async recordUrlScraping(user, collectionName, url, chunksAdded, modelId, textLength) {
        return this.recordAction(user._id?.toString() || 'unknown', user.username, collectionName, url, trainingHistory_1.TrainingAction.UPLOAD, {
            modelId,
            chunks_added: chunksAdded,
            source_type: 'url',
            url,
            text_length: textLength
        });
    }
    async recordTextInput(user, collectionName, documentName, chunksAdded, modelId, textLength) {
        return this.recordAction(user._id?.toString() || 'unknown', user.username, collectionName, documentName, trainingHistory_1.TrainingAction.UPLOAD, {
            modelId,
            chunks_added: chunksAdded,
            source_type: 'text',
            text_length: textLength
        });
    }
    async recordDeletion(user, collectionName, documentName, details = {}) {
        return this.recordAction(user._id?.toString() || 'unknown', user.username, collectionName, documentName, trainingHistory_1.TrainingAction.DELETE, details);
    }
    async getHistoryByUser(userId, limit = 50, offset = 0) {
        try {
            return await trainingHistory_1.TrainingHistory
                .find({ userId })
                .sort({ timestamp: -1 })
                .limit(limit)
                .skip(offset)
                .exec();
        }
        catch (error) {
            console.error('❌ Error getting user training history:', error);
            return [];
        }
    }
    async getHistoryByCollection(collectionName, limit = 50, offset = 0) {
        try {
            return await trainingHistory_1.TrainingHistory
                .find({ collectionName })
                .sort({ timestamp: -1 })
                .limit(limit)
                .skip(offset)
                .exec();
        }
        catch (error) {
            console.error('❌ Error getting collection training history:', error);
            return [];
        }
    }
    async getRecentHistory(limit = 100) {
        try {
            return await trainingHistory_1.TrainingHistory
                .find()
                .sort({ timestamp: -1 })
                .limit(limit)
                .exec();
        }
        catch (error) {
            console.error('❌ Error getting recent training history:', error);
            return [];
        }
    }
    async getHistoryStats() {
        try {
            const [totalActions, actionStats, recentUploads, activeUsers] = await Promise.all([
                trainingHistory_1.TrainingHistory.countDocuments(),
                trainingHistory_1.TrainingHistory.aggregate([
                    {
                        $group: {
                            _id: '$action',
                            count: { $sum: 1 }
                        }
                    }
                ]),
                trainingHistory_1.TrainingHistory.countDocuments({
                    action: trainingHistory_1.TrainingAction.UPLOAD,
                    timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                }),
                trainingHistory_1.TrainingHistory.distinct('userId', {
                    timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
                }).then(users => users.length)
            ]);
            const actionsByType = {};
            actionStats.forEach((stat) => {
                actionsByType[stat._id] = stat.count;
            });
            return {
                totalActions,
                actionsByType,
                recentUploads,
                activeUsers
            };
        }
        catch (error) {
            console.error('❌ Error getting training history stats:', error);
            return {
                totalActions: 0,
                actionsByType: {},
                recentUploads: 0,
                activeUsers: 0
            };
        }
    }
    async deleteHistoryByCollection(collectionName) {
        try {
            const result = await trainingHistory_1.TrainingHistory.deleteMany({ collectionName });
            console.log(`🗑️ Deleted ${result.deletedCount} training history records for collection: ${collectionName}`);
            return result.deletedCount || 0;
        }
        catch (error) {
            console.error('❌ Error deleting training history:', error);
            return 0;
        }
    }
    async deleteHistoryByDocument(collectionName, documentName) {
        try {
            const result = await trainingHistory_1.TrainingHistory.deleteMany({ collectionName, documentName });
            console.log(`🗑️ Deleted ${result.deletedCount} training history records for document: ${documentName}`);
            return result.deletedCount || 0;
        }
        catch (error) {
            console.error('❌ Error deleting document training history:', error);
            return 0;
        }
    }
}
exports.TrainingHistoryService = TrainingHistoryService;
exports.trainingHistoryService = new TrainingHistoryService();
//# sourceMappingURL=trainingHistoryService.js.map