import mongoose from 'mongoose';

export enum TrainingAction {
  UPLOAD = 'UPLOAD',
  DELETE = 'DELETE',
  UPDATE = 'UPDATE'
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

const trainingHistorySchema = new mongoose.Schema<ITrainingHistory>({
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true, index: true },
  collectionName: { type: String, required: true, index: true },
  documentName: { type: String, required: true },
  action: {
    type: String,
    enum: Object.values(TrainingAction),
    required: true
  },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true,
  collection: 'training_history'
});

// Indexes for better query performance
trainingHistorySchema.index({ userId: 1, timestamp: -1 });
trainingHistorySchema.index({ collectionName: 1, timestamp: -1 });
trainingHistorySchema.index({ action: 1, timestamp: -1 });

export const TrainingHistory = mongoose.model<ITrainingHistory>('TrainingHistory', trainingHistorySchema);
