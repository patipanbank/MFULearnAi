import { Schema, Document } from 'mongoose';

export enum TrainingAction {
  UPLOAD = 'upload',
  DELETE = 'delete',
  CREATE_COLLECTION = 'create_collection',
  UPDATE_COLLECTION = 'update_collection',
  DELETE_COLLECTION = 'delete_collection',
}

export interface TrainingHistory extends Document {
  userId: string;
  username: string;
  collectionName: string;
  documentName?: string;
  action: TrainingAction;
  timestamp: Date;
  details?: Record<string, any>;
}

export const TrainingHistorySchema = new Schema<TrainingHistory>({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  collectionName: { type: String, required: true },
  documentName: { type: String, required: false },
  action: { 
    type: String, 
    enum: Object.values(TrainingAction),
    required: true 
  },
  timestamp: { type: Date, default: Date.now },
  details: { type: Schema.Types.Mixed, required: false }
}, {
  timestamps: true,
  collection: 'training_history'
});

// Create indexes for better query performance
TrainingHistorySchema.index({ userId: 1, timestamp: -1 });
TrainingHistorySchema.index({ collectionName: 1, timestamp: -1 });
TrainingHistorySchema.index({ action: 1, timestamp: -1 }); 