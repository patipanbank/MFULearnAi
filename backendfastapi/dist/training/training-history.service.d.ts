import { Model } from 'mongoose';
import { TrainingHistory, TrainingAction } from '../models/training-history.model';
export declare class TrainingHistoryService {
    private trainingHistoryModel;
    constructor(trainingHistoryModel: Model<TrainingHistory>);
    recordAction(userId: string, username: string, collectionName: string, documentName: string, action: TrainingAction, details?: Record<string, any>): Promise<TrainingHistory>;
    getHistoryForUser(userId: string, limit?: number, offset?: number): Promise<TrainingHistory[]>;
    getHistoryForCollection(collectionName: string, limit?: number, offset?: number): Promise<TrainingHistory[]>;
    getHistoryByAction(action: TrainingAction, limit?: number, offset?: number): Promise<TrainingHistory[]>;
    deleteHistory(collectionName: string, documentName?: string): Promise<{
        deletedCount: number;
    }>;
    getStatistics(userId?: string): Promise<{
        totalActions: number;
        actionBreakdown: Record<TrainingAction, number>;
        recentActivity: TrainingHistory[];
    }>;
    private getActionBreakdown;
}
