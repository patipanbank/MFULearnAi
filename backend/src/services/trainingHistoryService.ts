import { TrainingHistory, ITrainingHistory, TrainingAction } from '../models/trainingHistory';
import { IUser } from '../models/user';

export class TrainingHistoryService {
  constructor() {
    console.log('✅ Training History service initialized');
  }

  async recordAction(
    userId: string,
    username: string,
    collectionName: string,
    documentName: string,
    action: TrainingAction,
    details: any = {}
  ): Promise<ITrainingHistory> {
    try {
      const historyRecord = new TrainingHistory({
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
    } catch (error) {
      console.error('❌ Error recording training history:', error);
      throw error;
    }
  }

  async recordFileUpload(
    user: IUser,
    collectionName: string,
    fileName: string,
    fileSize: number,
    chunksAdded: number,
    modelId: string
  ): Promise<ITrainingHistory> {
    return this.recordAction(
      user._id?.toString() || 'unknown',
      user.username,
      collectionName,
      fileName,
      TrainingAction.UPLOAD,
      {
        modelId,
        chunks_added: chunksAdded,
        source_type: 'file',
        file_size: fileSize
      }
    );
  }

  async recordUrlScraping(
    user: IUser,
    collectionName: string,
    url: string,
    chunksAdded: number,
    modelId: string,
    textLength: number
  ): Promise<ITrainingHistory> {
    return this.recordAction(
      user._id?.toString() || 'unknown',
      user.username,
      collectionName,
      url,
      TrainingAction.UPLOAD,
      {
        modelId,
        chunks_added: chunksAdded,
        source_type: 'url',
        url,
        text_length: textLength
      }
    );
  }

  async recordTextInput(
    user: IUser,
    collectionName: string,
    documentName: string,
    chunksAdded: number,
    modelId: string,
    textLength: number
  ): Promise<ITrainingHistory> {
    return this.recordAction(
      user._id?.toString() || 'unknown',
      user.username,
      collectionName,
      documentName,
      TrainingAction.UPLOAD,
      {
        modelId,
        chunks_added: chunksAdded,
        source_type: 'text',
        text_length: textLength
      }
    );
  }

  async recordDeletion(
    user: IUser,
    collectionName: string,
    documentName: string,
    details: any = {}
  ): Promise<ITrainingHistory> {
    return this.recordAction(
      user._id?.toString() || 'unknown',
      user.username,
      collectionName,
      documentName,
      TrainingAction.DELETE,
      details
    );
  }

  async getHistoryByUser(userId: string, limit: number = 50, offset: number = 0): Promise<ITrainingHistory[]> {
    try {
      return await TrainingHistory
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(offset)
        .exec();
    } catch (error) {
      console.error('❌ Error getting user training history:', error);
      return [];
    }
  }

  async getHistoryByCollection(collectionName: string, limit: number = 50, offset: number = 0): Promise<ITrainingHistory[]> {
    try {
      return await TrainingHistory
        .find({ collectionName })
        .sort({ timestamp: -1 })
        .limit(limit)
        .skip(offset)
        .exec();
    } catch (error) {
      console.error('❌ Error getting collection training history:', error);
      return [];
    }
  }

  async getRecentHistory(limit: number = 100): Promise<ITrainingHistory[]> {
    try {
      return await TrainingHistory
        .find()
        .sort({ timestamp: -1 })
        .limit(limit)
        .exec();
    } catch (error) {
      console.error('❌ Error getting recent training history:', error);
      return [];
    }
  }

  async getHistoryStats(): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    recentUploads: number;
    activeUsers: number;
  }> {
    try {
      const [
        totalActions,
        actionStats,
        recentUploads,
        activeUsers
      ] = await Promise.all([
        TrainingHistory.countDocuments(),
        TrainingHistory.aggregate([
          {
            $group: {
              _id: '$action',
              count: { $sum: 1 }
            }
          }
        ]),
        TrainingHistory.countDocuments({
          action: TrainingAction.UPLOAD,
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }),
        TrainingHistory.distinct('userId', {
          timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        }).then(users => users.length)
      ]);

      const actionsByType: Record<string, number> = {};
      actionStats.forEach((stat: any) => {
        actionsByType[stat._id] = stat.count;
      });

      return {
        totalActions,
        actionsByType,
        recentUploads,
        activeUsers
      };
    } catch (error) {
      console.error('❌ Error getting training history stats:', error);
      return {
        totalActions: 0,
        actionsByType: {},
        recentUploads: 0,
        activeUsers: 0
      };
    }
  }

  async deleteHistoryByCollection(collectionName: string): Promise<number> {
    try {
      const result = await TrainingHistory.deleteMany({ collectionName });
      console.log(`🗑️ Deleted ${result.deletedCount} training history records for collection: ${collectionName}`);
      return result.deletedCount || 0;
    } catch (error) {
      console.error('❌ Error deleting training history:', error);
      return 0;
    }
  }

  async deleteHistoryByDocument(collectionName: string, documentName: string): Promise<number> {
    try {
      const result = await TrainingHistory.deleteMany({ collectionName, documentName });
      console.log(`🗑️ Deleted ${result.deletedCount} training history records for document: ${documentName}`);
      return result.deletedCount || 0;
    } catch (error) {
      console.error('❌ Error deleting document training history:', error);
      return 0;
    }
  }
}

export const trainingHistoryService = new TrainingHistoryService();