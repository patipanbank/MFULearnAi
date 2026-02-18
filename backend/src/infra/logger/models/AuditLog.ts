import { Schema, Document } from 'mongoose';
import { logConnection } from '../db';

/**
 * Audit Log Schema for security and compliance tracking
 * Stores detailed audit trail of sensitive operations
 */

export interface IAuditLog extends Document {
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    environment: 'TEST' | 'PROD';
    ipAddress: string;
    userAgent: string;
    details: Record<string, any>;
    outcome: 'success' | 'failure';
    timestamp: Date;
    retentionDays: number;
    expiresAt: Date;
}

const AuditLogSchema: Schema = new Schema({
    userId: { type: String, index: true },
    action: { type: String, required: true, index: true },
    resource: { type: String, required: true },
    resourceId: { type: String },
    environment: {
        type: String,
        enum: ['TEST', 'PROD'],
        required: true,
        index: true
    },
    ipAddress: { type: String, required: true },
    userAgent: { type: String },
    details: { type: Schema.Types.Mixed, default: {} },
    outcome: {
        type: String,
        enum: ['success', 'failure'],
        default: 'success'
    },
    timestamp: { type: Date, default: Date.now, index: true },
    retentionDays: { type: Number, default: 90 },
    expiresAt: { type: Date, index: { expireAfterSeconds: 0 } }
});

// Compound index for efficient queries
AuditLogSchema.index({ userId: 1, action: 1, timestamp: -1 });
AuditLogSchema.index({ environment: 1, timestamp: -1 });

// Pre-save hook to calculate expiration
AuditLogSchema.pre('save', function (next) {
    const doc = this as unknown as IAuditLog;
    if (!doc.expiresAt) {
        const retentionMs = (doc.retentionDays || 90) * 24 * 60 * 60 * 1000;
        doc.expiresAt = new Date(Date.now() + retentionMs);
    }
    next();
});

export default logConnection.model<IAuditLog>('AuditLog', AuditLogSchema);
