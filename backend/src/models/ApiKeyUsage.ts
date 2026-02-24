/**
 * API Key Usage Log — Per-request usage tracking for billing & analytics.
 *
 * Each API call via /v1/* endpoints logs a record here.
 * Supports per-key, per-org, per-project aggregation.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IApiKeyUsage extends Document {
    apiKeyId: Types.ObjectId;
    userId: Types.ObjectId;
    organization: string;
    project: string;

    // Request metadata
    endpoint: string;          // '/v1/chat/completions', '/v1/embeddings'
    modelId: string;           // Bedrock model ID (renamed from 'model' to avoid Document conflict)
    modelAlias: string;        // OpenAI-style name
    streaming: boolean;

    // Token usage
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    weightedTokens: number;    // Cost-normalized units

    // Cost tracking
    costWeight: number;        // Model's cost multiplier at time of request
    estimatedCostUSD: number;  // Rough USD estimate (optional)

    // Request info
    requestIP: string;
    userAgent: string;
    statusCode: number;
    latencyMs: number;

    // Time
    timestamp: Date;
    /** Date string in Bangkok TZ for daily aggregation: 'YYYY-MM-DD' */
    dateKey: string;
    /** Month string for monthly aggregation: 'YYYY-MM' */
    monthKey: string;
}

const ApiKeyUsageSchema = new Schema({
    apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organization: { type: String, default: '', index: true },
    project: { type: String, default: '', index: true },

    endpoint: { type: String, required: true },
    modelId: { type: String, required: true },
    modelAlias: { type: String, default: '' },
    streaming: { type: Boolean, default: false },

    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    weightedTokens: { type: Number, default: 0 },

    costWeight: { type: Number, default: 1.0 },
    estimatedCostUSD: { type: Number, default: 0 },

    requestIP: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    statusCode: { type: Number, default: 200 },
    latencyMs: { type: Number, default: 0 },

    timestamp: { type: Date, default: Date.now, index: true },
    dateKey: { type: String, required: true, index: true },
    monthKey: { type: String, required: true, index: true },
});

// Compound indexes for efficient aggregation queries
ApiKeyUsageSchema.index({ apiKeyId: 1, dateKey: 1 });
ApiKeyUsageSchema.index({ apiKeyId: 1, monthKey: 1 });
ApiKeyUsageSchema.index({ organization: 1, monthKey: 1 });
ApiKeyUsageSchema.index({ project: 1, monthKey: 1 });
ApiKeyUsageSchema.index({ userId: 1, dateKey: 1 });

// TTL index: auto-delete records older than 90 days (configurable)
const USAGE_RETENTION_DAYS = parseInt(process.env.USAGE_RETENTION_DAYS || '90', 10);
ApiKeyUsageSchema.index({ timestamp: 1 }, { expireAfterSeconds: USAGE_RETENTION_DAYS * 86400 });

export default mongoose.model<IApiKeyUsage>('ApiKeyUsage', ApiKeyUsageSchema);
