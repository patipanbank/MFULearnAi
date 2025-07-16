import { Document } from 'mongoose';
export declare enum TrainingAction {
    UPLOAD = "upload",
    DELETE = "delete",
    CREATE_COLLECTION = "create_collection",
    UPDATE_COLLECTION = "update_collection",
    DELETE_COLLECTION = "delete_collection"
}
export type TrainingHistoryDocument = TrainingHistory & Document;
export declare class TrainingHistory {
    userId: string;
    username: string;
    collectionName: string;
    documentName?: string;
    action: TrainingAction;
    timestamp: Date;
    details?: Record<string, any>;
}
export declare const TrainingHistorySchema: import("mongoose").Schema<TrainingHistory, import("mongoose").Model<TrainingHistory, any, any, any, Document<unknown, any, TrainingHistory, any> & TrainingHistory & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, any>, {}, {}, {}, {}, import("mongoose").DefaultSchemaOptions, TrainingHistory, Document<unknown, {}, import("mongoose").FlatRecord<TrainingHistory>, {}> & import("mongoose").FlatRecord<TrainingHistory> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>;
