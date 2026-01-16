import mongoose, { Schema, Document } from 'mongoose';

export interface LogEntryDocument extends Document {
    timestamp: Date;
    level: 'debug' | 'info' | 'warn' | 'error' | 'audit';
    service: string;
    userId?: string;
    action: string;
    details?: any;
    environment: 'TEST' | 'PROD';
    retentionDays: number;
    expiresAt: Date;
}

const LogEntrySchema: Schema = new Schema({
    timestamp: { type: Date, default: Date.now, index: true },
    level: {
        type: String,
        required: true,
        enum: ['debug', 'info', 'warn', 'error', 'audit'],
        index: true
    },
    service: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    action: { type: String, required: true },
    details: { type: Schema.Types.Mixed },
    environment: { type: String, required: true, enum: ['TEST', 'PROD'], index: true },
    retentionDays: { type: Number, default: 30 },
    expiresAt: { type: Date, index: { expireAfterSeconds: 0 } }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
LogEntrySchema.index({ environment: 1, level: 1, timestamp: -1 });
LogEntrySchema.index({ service: 1, timestamp: -1 });

export default mongoose.model<LogEntryDocument>('LogEntry', LogEntrySchema);
