import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TrainingHistory, TrainingAction } from '../models/training-history.model';

@Injectable()
export class TrainingHistoryService {
  constructor(
    @InjectModel('TrainingHistory') private trainingHistoryModel: Model<TrainingHistory>
  ) {}

  async recordAction(
    userId: string,
    username: string,
    collectionName: string,
    documentName: string,
    action: TrainingAction,
    details?: Record<string, any>
  ): Promise<TrainingHistory> {
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

  async getHistoryForUser(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TrainingHistory[]> {
    return await this.trainingHistoryModel
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(offset)
      .exec();
  }

  async getHistoryForCollection(
    collectionName: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TrainingHistory[]> {
    return await this.trainingHistoryModel
      .find({ collectionName })
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(offset)
      .exec();
  }

  async getHistoryByAction(
    action: TrainingAction,
    limit: number = 50,
    offset: number = 0
  ): Promise<TrainingHistory[]> {
    return await this.trainingHistoryModel
      .find({ action })
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(offset)
      .exec();
  }

  async deleteHistory(
    collectionName: string,
    documentName?: string
  ): Promise<{ deletedCount: number }> {
    const filter: any = { collectionName };
    if (documentName) {
      filter.documentName = documentName;
    }

    const result = await this.trainingHistoryModel.deleteMany(filter);
    return { deletedCount: result.deletedCount || 0 };
  }

  async getStatistics(userId?: string): Promise<{
    totalActions: number;
    actionBreakdown: Record<TrainingAction, number>;
    recentActivity: TrainingHistory[];
  }> {
    const filter = userId ? { userId } : {};

    const [
      totalActions,
      actionBreakdown,
      recentActivity
    ] = await Promise.all([
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

  private async getActionBreakdown(filter: any): Promise<Record<TrainingAction, number>> {
    const pipeline = [
      { $match: filter },
      { $group: { _id: '$action', count: { $sum: 1 } } }
    ];

    const results = await this.trainingHistoryModel.aggregate(pipeline);
    
    const breakdown: Record<TrainingAction, number> = {
      [TrainingAction.UPLOAD]: 0,
      [TrainingAction.DELETE]: 0,
      [TrainingAction.CREATE_COLLECTION]: 0,
      [TrainingAction.UPDATE_COLLECTION]: 0,
      [TrainingAction.DELETE_COLLECTION]: 0,
    };

    results.forEach(result => {
      if (result._id in breakdown) {
        breakdown[result._id as TrainingAction] = result.count;
      }
    });

    return breakdown;
  }
} 