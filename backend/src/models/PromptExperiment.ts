import mongoose, { Schema, Document } from 'mongoose';

/**
 * PromptExperiment — A/B Testing model for system prompts.
 *
 * Allows running controlled experiments comparing prompt versions.
 * Traffic is split by weights, and metrics (response quality, tokens, latency)
 * are tracked per variant.
 *
 * Design:
 *   - Each experiment has 2-4 variants (prompt versions)
 *   - Traffic split by configurable weights (e.g., 50/50, 80/20)
 *   - User assignment is sticky (same user always gets same variant in an experiment)
 *   - Experiments can be auto-concluded when statistical significance is reached
 */

export interface IExperimentVariant {
    id: string;
    name: string;
    promptId?: string;        // Reference to Prompt model (null = use current active)
    promptVersion?: number;   // Specific version of the prompt
    promptContent?: string;   // Inline prompt override (for quick experiments)
    weight: number;           // Traffic weight (0-100)
    metrics: {
        impressions: number;
        avgResponseTokens: number;
        avgLatencyMs: number;
        avgUserRating: number;     // From feedback (1-5 scale)
        positiveRatings: number;   // Thumbs up count
        negativeRatings: number;   // Thumbs down count
        errorCount: number;
        totalTokens: number;
    };
}

export interface IExperimentAssignment {
    userId: string;
    variantId: string;
    assignedAt: Date;
}

export interface IPromptExperiment extends Document {
    name: string;
    description: string;
    status: 'draft' | 'running' | 'paused' | 'concluded';
    type: 'core' | 'scenario';
    /** Which environment this experiment runs in */
    environment: 'TEST' | 'PROD' | 'ALL';
    variants: IExperimentVariant[];
    /** Sticky user assignments */
    assignments: IExperimentAssignment[];
    /** Winner variant ID (set when concluded) */
    winnerId?: string;
    /** Auto-conclude when sample size is reached per variant */
    targetSampleSize: number;
    /** Minimum experiment duration before auto-conclusion (hours) */
    minimumDurationHours: number;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    concludedAt?: Date;
}

const ExperimentVariantSchema = new Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    promptId: String,
    promptVersion: Number,
    promptContent: String,
    weight: { type: Number, required: true, min: 0, max: 100 },
    metrics: {
        impressions: { type: Number, default: 0 },
        avgResponseTokens: { type: Number, default: 0 },
        avgLatencyMs: { type: Number, default: 0 },
        avgUserRating: { type: Number, default: 0 },
        positiveRatings: { type: Number, default: 0 },
        negativeRatings: { type: Number, default: 0 },
        errorCount: { type: Number, default: 0 },
        totalTokens: { type: Number, default: 0 }
    }
}, { _id: false });

const AssignmentSchema = new Schema({
    userId: { type: String, required: true },
    variantId: { type: String, required: true },
    assignedAt: { type: Date, default: Date.now }
}, { _id: false });

const PromptExperimentSchema = new Schema({
    name: { type: String, required: true },
    description: String,
    status: {
        type: String,
        enum: ['draft', 'running', 'paused', 'concluded'],
        default: 'draft'
    },
    type: {
        type: String,
        enum: ['core', 'scenario'],
        default: 'core'
    },
    environment: {
        type: String,
        enum: ['TEST', 'PROD', 'ALL'],
        default: 'TEST'
    },
    variants: [ExperimentVariantSchema],
    assignments: [AssignmentSchema],
    winnerId: String,
    targetSampleSize: { type: Number, default: 100 },
    minimumDurationHours: { type: Number, default: 24 },
    createdBy: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    concludedAt: Date
});

PromptExperimentSchema.index({ status: 1, environment: 1 });
PromptExperimentSchema.index({ 'assignments.userId': 1 });

export const PromptExperiment = mongoose.model<IPromptExperiment>('PromptExperiment', PromptExperimentSchema);
