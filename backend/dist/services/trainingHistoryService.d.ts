import { ITrainingHistory, TrainingAction } from '../models/trainingHistory';
import { IUser } from '../models/user';
export declare class TrainingHistoryService {
    constructor();
    recordAction(userId: string, username: string, collectionName: string, documentName: string, action: TrainingAction, details?: any): Promise<ITrainingHistory>;
    recordFileUpload(user: IUser, collectionName: string, fileName: string, fileSize: number, chunksAdded: number, modelId: string): Promise<ITrainingHistory>;
    recordUrlScraping(user: IUser, collectionName: string, url: string, chunksAdded: number, modelId: string, textLength: number): Promise<ITrainingHistory>;
    recordTextInput(user: IUser, collectionName: string, documentName: string, chunksAdded: number, modelId: string, textLength: number): Promise<ITrainingHistory>;
    recordDeletion(user: IUser, collectionName: string, documentName: string, details?: any): Promise<ITrainingHistory>;
    getHistoryByUser(userId: string, limit?: number, offset?: number): Promise<ITrainingHistory[]>;
    getHistoryByCollection(collectionName: string, limit?: number, offset?: number): Promise<ITrainingHistory[]>;
    getRecentHistory(limit?: number): Promise<ITrainingHistory[]>;
    getHistoryStats(): Promise<{
        totalActions: number;
        actionsByType: Record<string, number>;
        recentUploads: number;
        activeUsers: number;
    }>;
    deleteHistoryByCollection(collectionName: string): Promise<number>;
    deleteHistoryByDocument(collectionName: string, documentName: string): Promise<number>;
}
export declare const trainingHistoryService: TrainingHistoryService;
//# sourceMappingURL=trainingHistoryService.d.ts.map