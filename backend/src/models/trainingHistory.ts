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

// Comprehensive indexes for training history queries

// Primary user queries
trainingHistorySchema.index({ userId: 1, timestamp: -1 }); // User's training history
trainingHistorySchema.index({ username: 1, timestamp: -1 }); // Training history by username

// Collection-based queries
trainingHistorySchema.index({ collectionName: 1, timestamp: -1 }); // Collection activity history
trainingHistorySchema.index({ collectionName: 1, action: 1, timestamp: -1 }); // Collection actions

// Action-based analytics
trainingHistorySchema.index({ action: 1, timestamp: -1 }); // Filter by action type
trainingHistorySchema.index({ action: 1, userId: 1, timestamp: -1 }); // User actions

// Admin and analytics queries
trainingHistorySchema.index({ timestamp: -1 }); // Recent activity across all users
trainingHistorySchema.index({ userId: 1, action: 1 }); // User activity summary
trainingHistorySchema.index({ collectionName: 1, userId: 1 }); // User activity per collection

// Document-level queries
trainingHistorySchema.index({ documentName: 1, collectionName: 1 }); // Document history
trainingHistorySchema.index({ 'details.modelId': 1, timestamp: -1 }); // Activity by model

// Error tracking
trainingHistorySchema.index({ 'details.error': 1, timestamp: -1 }); // Failed operations tracking

export const TrainingHistory = mongoose.model<ITrainingHistory>('TrainingHistory', trainingHistorySchema);