import mongoose, { Schema, Document } from 'mongoose';

/**
 * PromptAnalytics — Per-prompt-version performance metrics.
 *
 * Tracks how each prompt version performs in production:
 *   - Token efficiency (input/output tokens)
 *   - Response quality (user feedback correlation)
 *   - Latency impact
 *   - Error rates
 *   - Tool usage patterns (which tools get invoked)
 *
 * Aggregated hourly for efficient querying.
 */

export interface IPromptAnalytics extends Document {
    promptId: string;
    promptVersion: number;
    environment: 'TEST' | 'PROD';
    /** Hourly bucket for time-series aggregation */
    hourBucket: Date;
    metrics: {
        totalRequests: number;
        avgInputTokens: number;
        avgOutputTokens: number;
        avgLatencyMs: number;
        avgSteps: number;
        positiveRatings: number;
        negativeRatings: number;
        errorCount: number;
        toolUsageCount: Record<string, number>;
        answerModeDistribution: Record<string, number>;
    };
    createdAt: Date;
}

const PromptAnalyticsSchema = new Schema({
    promptId: { type: String, required: true },
    promptVersion: { type: Number, required: true },
    environment: { type: String, enum: ['TEST', 'PROD'], required: true },
    hourBucket: { type: Date, required: true },
    metrics: {
        totalRequests: { type: Number, default: 0 },
        avgInputTokens: { type: Number, default: 0 },
        avgOutputTokens: { type: Number, default: 0 },
        avgLatencyMs: { type: Number, default: 0 },
        avgSteps: { type: Number, default: 0 },
        positiveRatings: { type: Number, default: 0 },
        negativeRatings: { type: Number, default: 0 },
        errorCount: { type: Number, default: 0 },
        toolUsageCount: { type: Schema.Types.Mixed, default: {} },
        answerModeDistribution: { type: Schema.Types.Mixed, default: {} }
    },
    createdAt: { type: Date, default: Date.now }
});

// Compound index for efficient time-series queries
PromptAnalyticsSchema.index({ promptId: 1, promptVersion: 1, hourBucket: -1 });
PromptAnalyticsSchema.index({ environment: 1, hourBucket: -1 });

export const PromptAnalytics = mongoose.model<IPromptAnalytics>('PromptAnalytics', PromptAnalyticsSchema);
