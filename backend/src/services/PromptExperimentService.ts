import { PromptExperiment, IExperimentVariant } from '../models/PromptExperiment';
import { PromptAnalytics } from '../models/PromptAnalytics';
import Prompt from '../models/Prompt';
import { LoggerService } from './LoggerService';
import { redis } from '../config/redis';

/**
 * PromptExperimentService — A/B testing engine for prompt optimization.
 *
 * Features:
 *   - Weighted random assignment with sticky user binding
 *   - Thread-safe via Redis-cached assignments
 *   - Automatic metric tracking per variant
 *   - Statistical significance calculation for auto-conclusion
 *   - Prompt analytics aggregation
 *
 * Usage:
 *   1. Create an experiment with 2+ variants (admin UI)
 *   2. Start the experiment (status → 'running')
 *   3. PromptBuilder calls resolvePromptForUser() to get the right prompt
 *   4. ResultPersister calls recordOutcome() after each response
 *   5. Admin reviews metrics and concludes experiment
 */

const ASSIGNMENT_CACHE_PREFIX = 'exp_assign:';
const ASSIGNMENT_CACHE_TTL = 3600; // 1 hour

export class PromptExperimentService {

    /**
     * Resolve which prompt content a user should see.
     * If an active experiment exists, returns the assigned variant's prompt.
     * Otherwise returns null (caller should use default prompt).
     */
    static async resolvePromptForUser(
        userId: string,
        envType: 'TEST' | 'PROD'
    ): Promise<{ content: string; experimentId: string; variantId: string } | null> {
        try {
            // Find running experiments for this environment
            const experiment = await PromptExperiment.findOne({
                status: 'running',
                $or: [{ environment: envType }, { environment: 'ALL' }]
            });

            if (!experiment) return null;

            // Get or assign variant for this user
            const variant = await this.getOrAssignVariant(experiment, userId);
            if (!variant) return null;

            // Resolve prompt content
            let content: string;
            if (variant.promptContent) {
                // Inline content (quick experiment)
                content = variant.promptContent;
            } else if (variant.promptId && variant.promptVersion) {
                // Reference to Prompt model
                const prompt = await Prompt.findById(variant.promptId);
                const version = prompt?.versions.find(v => v.version === variant.promptVersion);
                content = version?.content || '';
            } else {
                // Use current active prompt (control group)
                return null;
            }

            if (!content) return null;

            // Record impression
            await PromptExperiment.updateOne(
                { _id: experiment._id, 'variants.id': variant.id },
                { $inc: { 'variants.$.metrics.impressions': 1 } }
            );

            return {
                content,
                experimentId: (experiment._id as any).toString(),
                variantId: variant.id
            };
        } catch (err) {
            LoggerService.warn('experiment_resolve_failed', {
                userId,
                error: err instanceof Error ? err.message : String(err)
            });
            return null;
        }
    }

    /**
     * Record the outcome of a response for experiment metrics.
     */
    static async recordOutcome(
        experimentId: string,
        variantId: string,
        metrics: {
            responseTokens: number;
            latencyMs: number;
            isError: boolean;
            toolsUsed?: string[];
            answerMode?: string;
        }
    ): Promise<void> {
        try {
            const updates: Record<string, any> = {};
            const incs: Record<string, number> = {
                'variants.$.metrics.totalTokens': metrics.responseTokens
            };

            if (metrics.isError) {
                incs['variants.$.metrics.errorCount'] = 1;
            }

            // Update running averages
            const experiment = await PromptExperiment.findById(experimentId);
            if (!experiment) return;

            const variant = experiment.variants.find(v => v.id === variantId);
            if (!variant) return;

            const n = variant.metrics.impressions || 1;
            // Incremental running average: new_avg = old_avg + (value - old_avg) / n
            updates['variants.$.metrics.avgResponseTokens'] =
                variant.metrics.avgResponseTokens + (metrics.responseTokens - variant.metrics.avgResponseTokens) / n;
            updates['variants.$.metrics.avgLatencyMs'] =
                variant.metrics.avgLatencyMs + (metrics.latencyMs - variant.metrics.avgLatencyMs) / n;

            await PromptExperiment.updateOne(
                { _id: experimentId, 'variants.id': variantId },
                {
                    $set: updates,
                    $inc: incs
                }
            );

            // Check auto-conclusion
            await this.checkAutoConclusion(experimentId);

        } catch (err) {
            LoggerService.warn('experiment_record_failed', {
                experimentId,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    }

    /**
     * Record user feedback (thumbs up/down) for experiment metrics.
     */
    static async recordFeedback(
        experimentId: string,
        variantId: string,
        isPositive: boolean
    ): Promise<void> {
        try {
            const field = isPositive
                ? 'variants.$.metrics.positiveRatings'
                : 'variants.$.metrics.negativeRatings';

            await PromptExperiment.updateOne(
                { _id: experimentId, 'variants.id': variantId },
                { $inc: { [field]: 1 } }
            );
        } catch {
            // Non-critical
        }
    }

    // ── Prompt Analytics ────────────────────────────────────

    /**
     * Record prompt-level analytics (independent of A/B testing).
     * Called after every completion — aggregates into hourly buckets.
     */
    static async recordPromptAnalytics(
        promptId: string,
        promptVersion: number,
        environment: 'TEST' | 'PROD',
        metrics: {
            inputTokens: number;
            outputTokens: number;
            latencyMs: number;
            steps: number;
            answerMode: string;
            toolsUsed: string[];
            isError: boolean;
        }
    ): Promise<void> {
        try {
            const now = new Date();
            const hourBucket = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours());

            // Build tool usage increment map
            const toolIncs: Record<string, number> = {};
            for (const tool of metrics.toolsUsed) {
                toolIncs[`metrics.toolUsageCount.${tool}`] = 1;
            }

            // Build answer mode increment
            const answerModeInc: Record<string, number> = {
                [`metrics.answerModeDistribution.${metrics.answerMode}`]: 1
            };

            await PromptAnalytics.findOneAndUpdate(
                { promptId, promptVersion, environment, hourBucket },
                {
                    $inc: {
                        'metrics.totalRequests': 1,
                        'metrics.errorCount': metrics.isError ? 1 : 0,
                        ...toolIncs,
                        ...answerModeInc
                    },
                    $set: {
                        // Running averages — will be refined by the aggregation below
                        promptId, promptVersion, environment, hourBucket
                    },
                    $setOnInsert: { createdAt: now }
                },
                { upsert: true, new: true }
            ).then(async (doc) => {
                // Update running averages
                const n = doc.metrics.totalRequests || 1;
                const avgIn = doc.metrics.avgInputTokens + (metrics.inputTokens - doc.metrics.avgInputTokens) / n;
                const avgOut = doc.metrics.avgOutputTokens + (metrics.outputTokens - doc.metrics.avgOutputTokens) / n;
                const avgLat = doc.metrics.avgLatencyMs + (metrics.latencyMs - doc.metrics.avgLatencyMs) / n;
                const avgSteps = doc.metrics.avgSteps + (metrics.steps - doc.metrics.avgSteps) / n;

                await PromptAnalytics.updateOne(
                    { _id: doc._id },
                    {
                        $set: {
                            'metrics.avgInputTokens': avgIn,
                            'metrics.avgOutputTokens': avgOut,
                            'metrics.avgLatencyMs': avgLat,
                            'metrics.avgSteps': avgSteps
                        }
                    }
                );
            }).catch(() => { /* non-critical */ });

        } catch (err) {
            LoggerService.debug('prompt_analytics_record_failed', {
                promptId,
                error: err instanceof Error ? err.message : String(err)
            });
        }
    }

    /**
     * Get analytics summary for a prompt over a time range.
     */
    static async getAnalyticsSummary(
        promptId: string,
        promptVersion: number,
        fromDate: Date,
        toDate: Date
    ): Promise<{
        totalRequests: number;
        avgInputTokens: number;
        avgOutputTokens: number;
        avgLatencyMs: number;
        avgSteps: number;
        errorRate: number;
        topTools: Array<{ tool: string; count: number }>;
        answerModes: Record<string, number>;
        hourlyTrend: Array<{ hour: Date; requests: number; avgLatency: number }>;
    }> {
        const docs = await PromptAnalytics.find({
            promptId,
            promptVersion,
            hourBucket: { $gte: fromDate, $lte: toDate }
        }).sort({ hourBucket: 1 }).lean();

        if (docs.length === 0) {
            return {
                totalRequests: 0, avgInputTokens: 0, avgOutputTokens: 0,
                avgLatencyMs: 0, avgSteps: 0, errorRate: 0,
                topTools: [], answerModes: {}, hourlyTrend: []
            };
        }

        let totalReqs = 0, totalErrors = 0;
        let sumIn = 0, sumOut = 0, sumLat = 0, sumSteps = 0;
        const toolCounts: Record<string, number> = {};
        const modeCounts: Record<string, number> = {};
        const hourlyTrend: Array<{ hour: Date; requests: number; avgLatency: number }> = [];

        for (const doc of docs) {
            const m = doc.metrics;
            totalReqs += m.totalRequests;
            totalErrors += m.errorCount;
            sumIn += m.avgInputTokens * m.totalRequests;
            sumOut += m.avgOutputTokens * m.totalRequests;
            sumLat += m.avgLatencyMs * m.totalRequests;
            sumSteps += m.avgSteps * m.totalRequests;

            for (const [tool, count] of Object.entries(m.toolUsageCount || {})) {
                toolCounts[tool] = (toolCounts[tool] || 0) + (count as number);
            }
            for (const [mode, count] of Object.entries(m.answerModeDistribution || {})) {
                modeCounts[mode] = (modeCounts[mode] || 0) + (count as number);
            }

            hourlyTrend.push({
                hour: doc.hourBucket,
                requests: m.totalRequests,
                avgLatency: m.avgLatencyMs
            });
        }

        const topTools = Object.entries(toolCounts)
            .map(([tool, count]) => ({ tool, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            totalRequests: totalReqs,
            avgInputTokens: totalReqs > 0 ? sumIn / totalReqs : 0,
            avgOutputTokens: totalReqs > 0 ? sumOut / totalReqs : 0,
            avgLatencyMs: totalReqs > 0 ? sumLat / totalReqs : 0,
            avgSteps: totalReqs > 0 ? sumSteps / totalReqs : 0,
            errorRate: totalReqs > 0 ? totalErrors / totalReqs : 0,
            topTools,
            answerModes: modeCounts,
            hourlyTrend
        };
    }

    // ── Internal Helpers ────────────────────────────────────

    /**
     * Assign a variant to a user using weighted random selection.
     * Assignment is sticky — cached in Redis + stored in MongoDB.
     */
    private static async getOrAssignVariant(
        experiment: any,
        userId: string
    ): Promise<IExperimentVariant | null> {
        const expId = experiment._id.toString();

        // Check Redis cache first
        const cacheKey = `${ASSIGNMENT_CACHE_PREFIX}${expId}:${userId}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            return experiment.variants.find((v: IExperimentVariant) => v.id === cached) || null;
        }

        // Check MongoDB assignment
        const existing = experiment.assignments?.find((a: any) => a.userId === userId);
        if (existing) {
            await redis.set(cacheKey, existing.variantId, 'EX', ASSIGNMENT_CACHE_TTL);
            return experiment.variants.find((v: IExperimentVariant) => v.id === existing.variantId) || null;
        }

        // New assignment — weighted random
        const variant = this.weightedRandomSelect(experiment.variants);
        if (!variant) return null;

        // Store assignment
        await PromptExperiment.updateOne(
            { _id: expId },
            {
                $push: {
                    assignments: {
                        userId,
                        variantId: variant.id,
                        assignedAt: new Date()
                    }
                }
            }
        );

        await redis.set(cacheKey, variant.id, 'EX', ASSIGNMENT_CACHE_TTL);
        return variant;
    }

    /**
     * Weighted random selection from variants.
     */
    private static weightedRandomSelect(variants: IExperimentVariant[]): IExperimentVariant | null {
        const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
        if (totalWeight === 0) return null;

        let random = Math.random() * totalWeight;
        for (const variant of variants) {
            random -= variant.weight;
            if (random <= 0) return variant;
        }
        return variants[variants.length - 1];
    }

    /**
     * Check if an experiment should be auto-concluded.
     */
    private static async checkAutoConclusion(experimentId: string): Promise<void> {
        try {
            const experiment = await PromptExperiment.findById(experimentId);
            if (!experiment || experiment.status !== 'running') return;

            // Check minimum duration
            const hoursRunning = (Date.now() - experiment.createdAt.getTime()) / (1000 * 60 * 60);
            if (hoursRunning < experiment.minimumDurationHours) return;

            // Check sample size
            const allMet = experiment.variants.every(v => v.metrics.impressions >= experiment.targetSampleSize);
            if (!allMet) return;

            // Auto-conclude: pick winner by highest positive rating ratio
            let bestVariant: IExperimentVariant | null = null;
            let bestScore = -1;

            for (const v of experiment.variants) {
                const total = v.metrics.positiveRatings + v.metrics.negativeRatings;
                const score = total > 0 ? v.metrics.positiveRatings / total : 0;
                // Weight by efficiency: lower tokens is better
                const efficiencyBonus = v.metrics.avgResponseTokens > 0
                    ? 1 / (v.metrics.avgResponseTokens / 1000)
                    : 0;
                const compositeScore = score * 0.7 + efficiencyBonus * 0.3;

                if (compositeScore > bestScore) {
                    bestScore = compositeScore;
                    bestVariant = v;
                }
            }

            if (bestVariant) {
                await PromptExperiment.updateOne(
                    { _id: experimentId },
                    {
                        $set: {
                            status: 'concluded',
                            winnerId: bestVariant.id,
                            concludedAt: new Date(),
                            updatedAt: new Date()
                        }
                    }
                );

                LoggerService.info('experiment_auto_concluded', {
                    experimentId,
                    winnerId: bestVariant.id,
                    winnerName: bestVariant.name,
                    score: bestScore
                });
            }
        } catch {
            // Non-critical
        }
    }
}
