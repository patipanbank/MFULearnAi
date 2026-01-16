import mongoose, { Schema, Document } from 'mongoose';

export interface LogEntryDocument extends Document {
    timestamp: Date;
    level: 'info' | 'warn' | 'error' | 'audit';
    service: string;
    userId?: string;
    action: string;
    details?: any;
    environment: string;
}

const LogEntrySchema: Schema = new Schema({
    timestamp: { type: Date, default: Date.now },
    level: { type: String, required: true },
    service: { type: String, required: true },
    userId: { type: String },
    action: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    environment: { type: String, required: true }
}, {
    timestamps: true,
    capped: { size: 52428800 } // 50MB Capped Collection for logs
});

export default mongoose.model<LogEntryDocument>('LogEntry', LogEntrySchema);
