import mongoose from 'mongoose';

export interface ITrainingHistory {
  userId: string;
  username: string;
  collectionName: string;
  documentName: string;
  action: 'upload' | 'delete' | 'create_collection' | 'update_collection' | 'delete_collection' | 'crawl_url';
  timestamp: Date;
  details?: Record<string, any>;
}

const trainingHistorySchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  collectionName: { type: String, required: true },
  documentName: { type: String },
  action: { 
    type: String, 
    enum: ['upload', 'delete', 'create_collection', 'update_collection', 'delete_collection', 'crawl_url'],
    required: true 
  },
  timestamp: { type: Date, default: Date.now },
  details: { 
    type: mongoose.Schema.Types.Mixed,
    // สำหรับ crawl_url จะเก็บข้อมูลเพิ่มเติมเช่น:
    // - modelId: string
    // - pagesProcessed: number
    // - depth: number
    // - success: boolean
    // - error?: string
  }
}, { timestamps: true });

const TrainingHistory = mongoose.model('TrainingHistory', trainingHistorySchema);
export { TrainingHistory }; 