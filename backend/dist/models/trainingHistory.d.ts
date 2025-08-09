import mongoose from 'mongoose';
export declare enum TrainingAction {
    UPLOAD = "UPLOAD",
    DELETE = "DELETE",
    UPDATE = "UPDATE"
}
export interface ITrainingHistory {
    _id?: string;
    userId: string;
    username: string;
    collectionName: string;
    documentName: string;
    action: TrainingAction;
    details: {
        modelId?: string;
        chunks_added?: number;
        source_type?: string;
        source_path?: string;
        file_size?: number;
        text_length?: number;
        url?: string;
        error?: string;
        [key: string]: any;
    };
    timestamp: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const TrainingHistory: mongoose.Model<ITrainingHistory, {}, {}, {}, mongoose.Document<unknown, {}, ITrainingHistory, {}> & ITrainingHistory & Required<{
    _id: string;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=trainingHistory.d.ts.map