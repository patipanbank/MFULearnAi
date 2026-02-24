/**
 * API Key Usage Service — Tracks per-key usage for billing, quotas, and analytics.
 *
 * - Fire-and-forget usage logging (non-blocking)
 * - Daily/monthly aggregation queries
 * - Per-key quota enforcement helpers
 * - Organization-level billing summaries
 */

import ApiKeyUsage from '../models/ApiKeyUsage';
import ApiKey from '../models/ApiKey';
import { redis } from '../config/redis';
import { getCostWeight } from '../config/models';
import { getOpenAIModelName } from '../openai/modelMapping';

const TZ_OFFSET = 7 * 60 * 60 * 1000; // Bangkok UTC+7

function getDateKeys(): { dateKey: string; monthKey: string } {
    const bangkokNow = new Date(Date.now() + TZ_OFFSET);
    const y = bangkokNow.getUTCFullYear();
    const m = String(bangkokNow.getUTCMonth() + 1).padStart(2, '0');
    const d = String(bangkokNow.getUTCDate()).padStart(2, '0');
    return {
        dateKey: `${y}-${m}-${d}`,
        monthKey: `${y}-${m}`,
    };
}

export interface UsageTrackingData {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    weightedTokens: number;
    endpoint: string;
    streaming: boolean;
    requestIP?: string;
    userAgent?: string;
    statusCode?: number;
    latencyMs?: number;
}

export class ApiKeyUsageService {

    /**
     * Log a usage record (fire-and-forget).
     */
    static async trackUsage(apiKeyId: string | undefined, data: UsageTrackingData): Promise<void> {
        if (!apiKeyId) return;

        try {
            const apiKey = await ApiKey.findById(apiKeyId).select('user organization project').lean();
            if (!apiKey) return;

            const { dateKey, monthKey } = getDateKeys();

            await ApiKeyUsage.create({
                apiKeyId,
                userId: apiKey.user,
                organization: apiKey.organization || '',
                project: apiKey.project || '',
                endpoint: data.endpoint,
                modelId: data.model,
                modelAlias: getOpenAIModelName(data.model),
                streaming: data.streaming,
                promptTokens: data.promptTokens,
                completionTokens: data.completionTokens,
                totalTokens: data.totalTokens,
                weightedTokens: data.weightedTokens,
                costWeight: getCostWeight(data.model),
                estimatedCostUSD: 0, // TODO: implement real cost estimation
                requestIP: data.requestIP || '',
                userAgent: data.userAgent || '',
                statusCode: data.statusCode || 200,
                latencyMs: data.latencyMs || 0,
                dateKey,
                monthKey,
            });

            // Update counters on ApiKey (atomic increment)
            await ApiKey.updateOne({ _id: apiKeyId }, {
                $inc: {
                    totalRequests: 1,
                    totalTokens: data.totalTokens,
                },
                $set: { lastUsedAt: new Date() },
            });

            // Update Redis cache for rate limit checks
            const dailyCacheKey = `apikey_usage:${apiKeyId}:${dateKey}`;
            const monthlyCacheKey = `apikey_usage:${apiKeyId}:${monthKey}`;
            try {
                await redis.incrby(dailyCacheKey, data.weightedTokens);
                await redis.expire(dailyCacheKey, 86400 * 2); // 2 days TTL
                await redis.incrby(monthlyCacheKey, data.weightedTokens);
                await redis.expire(monthlyCacheKey, 86400 * 35); // 35 days TTL
            } catch { /* Redis down — non-critical */ }

        } catch (err) {
            console.error('[ApiKeyUsageService] Failed to track usage:', err);
        }
    }

    /**
     * Get today's weighted token usage for a specific key.
     */
    static async getDailyUsage(apiKeyId: string): Promise<number> {
        const { dateKey } = getDateKeys();
        const cacheKey = `apikey_usage:${apiKeyId}:${dateKey}`;

        // Try Redis
        try {
            const cached = await redis.get(cacheKey);
            if (cached !== null) return parseInt(cached, 10);
        } catch { /* fall through */ }

        // Fallback to MongoDB
        const result = await ApiKeyUsage.aggregate([
            { $match: { apiKeyId, dateKey } },
            { $group: { _id: null, total: { $sum: '$weightedTokens' } } },
        ]);

        const usage = result[0]?.total || 0;
        try {
            await redis.set(cacheKey, String(usage), 'EX', 60);
        } catch { /* ignore */ }

        return usage;
    }

    /**
     * Get this month's weighted token usage for a specific key.
     */
    static async getMonthlyUsage(apiKeyId: string): Promise<number> {
        const { monthKey } = getDateKeys();
        const cacheKey = `apikey_usage:${apiKeyId}:${monthKey}`;

        try {
            const cached = await redis.get(cacheKey);
            if (cached !== null) return parseInt(cached, 10);
        } catch { /* fall through */ }

        const result = await ApiKeyUsage.aggregate([
            { $match: { apiKeyId, monthKey } },
            { $group: { _id: null, total: { $sum: '$weightedTokens' } } },
        ]);

        const usage = result[0]?.total || 0;
        try {
            await redis.set(cacheKey, String(usage), 'EX', 300);
        } catch { /* ignore */ }

        return usage;
    }

    /**
     * Get usage analytics for a specific key (daily breakdown).
     */
    static async getKeyAnalytics(apiKeyId: string, days: number = 30): Promise<any> {
        const { dateKey } = getDateKeys();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [daily, byModel, summary] = await Promise.all([
            // Daily breakdown
            ApiKeyUsage.aggregate([
                { $match: { apiKeyId, timestamp: { $gte: startDate } } },
                {
                    $group: {
                        _id: '$dateKey',
                        requests: { $sum: 1 },
                        totalTokens: { $sum: '$totalTokens' },
                        weightedTokens: { $sum: '$weightedTokens' },
                        promptTokens: { $sum: '$promptTokens' },
                        completionTokens: { $sum: '$completionTokens' },
                    },
                },
                { $sort: { _id: 1 } },
            ]),

            // By model
            ApiKeyUsage.aggregate([
                { $match: { apiKeyId, timestamp: { $gte: startDate } } },
                {
                    $group: {
                        _id: '$modelAlias',
                        requests: { $sum: 1 },
                        totalTokens: { $sum: '$totalTokens' },
                        weightedTokens: { $sum: '$weightedTokens' },
                    },
                },
                { $sort: { requests: -1 } },
            ]),

            // Total summary
            ApiKeyUsage.aggregate([
                { $match: { apiKeyId, timestamp: { $gte: startDate } } },
                {
                    $group: {
                        _id: null,
                        requests: { $sum: 1 },
                        totalTokens: { $sum: '$totalTokens' },
                        weightedTokens: { $sum: '$weightedTokens' },
                        avgLatency: { $avg: '$latencyMs' },
                    },
                },
            ]),
        ]);

        return {
            daily,
            byModel,
            summary: summary[0] || { requests: 0, totalTokens: 0, weightedTokens: 0, avgLatency: 0 },
        };
    }

    /**
     * Get organization-level usage summary.
     */
    static async getOrgUsage(organization: string, monthKey?: string): Promise<any> {
        const targetMonth = monthKey || getDateKeys().monthKey;

        const [byKey, byProject, total] = await Promise.all([
            // Per-key breakdown
            ApiKeyUsage.aggregate([
                { $match: { organization, monthKey: targetMonth } },
                {
                    $group: {
                        _id: '$apiKeyId',
                        requests: { $sum: 1 },
                        totalTokens: { $sum: '$totalTokens' },
                        weightedTokens: { $sum: '$weightedTokens' },
                    },
                },
                { $sort: { weightedTokens: -1 } },
                {
                    $lookup: {
                        from: 'apikeys',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'keyInfo',
                    },
                },
                { $unwind: { path: '$keyInfo', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        apiKeyId: '$_id',
                        keyName: '$keyInfo.name',
                        project: '$keyInfo.project',
                        requests: 1,
                        totalTokens: 1,
                        weightedTokens: 1,
                    },
                },
            ]),

            // Per-project breakdown
            ApiKeyUsage.aggregate([
                { $match: { organization, monthKey: targetMonth } },
                {
                    $group: {
                        _id: '$project',
                        requests: { $sum: 1 },
                        totalTokens: { $sum: '$totalTokens' },
                        weightedTokens: { $sum: '$weightedTokens' },
                    },
                },
                { $sort: { weightedTokens: -1 } },
            ]),

            // Total
            ApiKeyUsage.aggregate([
                { $match: { organization, monthKey: targetMonth } },
                {
                    $group: {
                        _id: null,
                        requests: { $sum: 1 },
                        totalTokens: { $sum: '$totalTokens' },
                        weightedTokens: { $sum: '$weightedTokens' },
                    },
                },
            ]),
        ]);

        return {
            month: targetMonth,
            organization,
            byKey,
            byProject,
            total: total[0] || { requests: 0, totalTokens: 0, weightedTokens: 0 },
        };
    }

    /**
     * Admin: Get all-keys usage summary for dashboard.
     */
    static async getAdminDashboard(days: number = 30): Promise<any> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const [daily, topKeys, topOrgs, byEndpoint] = await Promise.all([
            // Daily totals
            ApiKeyUsage.aggregate([
                { $match: { timestamp: { $gte: startDate } } },
                {
                    $group: {
                        _id: '$dateKey',
                        requests: { $sum: 1 },
                        totalTokens: { $sum: '$totalTokens' },
                        weightedTokens: { $sum: '$weightedTokens' },
                        uniqueKeys: { $addToSet: '$apiKeyId' },
                    },
                },
                {
                    $project: {
                        date: '$_id',
                        requests: 1,
                        totalTokens: 1,
                        weightedTokens: 1,
                        activeKeys: { $size: '$uniqueKeys' },
                    },
                },
                { $sort: { _id: 1 } },
            ]),

            // Top keys by usage
            ApiKeyUsage.aggregate([
                { $match: { timestamp: { $gte: startDate } } },
                {
                    $group: {
                        _id: '$apiKeyId',
                        requests: { $sum: 1 },
                        totalTokens: { $sum: '$totalTokens' },
                        weightedTokens: { $sum: '$weightedTokens' },
                    },
                },
                { $sort: { weightedTokens: -1 } },
                { $limit: 20 },
                {
                    $lookup: {
                        from: 'apikeys',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'keyInfo',
                    },
                },
                { $unwind: { path: '$keyInfo', preserveNullAndEmptyArrays: true } },
                {
                    $project: {
                        apiKeyId: '$_id',
                        keyName: '$keyInfo.name',
                        organization: '$keyInfo.organization',
                        project: '$keyInfo.project',
                        requests: 1,
                        totalTokens: 1,
                        weightedTokens: 1,
                    },
                },
            ]),

            // Top organizations
            ApiKeyUsage.aggregate([
                { $match: { timestamp: { $gte: startDate }, organization: { $ne: '' } } },
                {
                    $group: {
                        _id: '$organization',
                        requests: { $sum: 1 },
                        totalTokens: { $sum: '$totalTokens' },
                        weightedTokens: { $sum: '$weightedTokens' },
                        uniqueKeys: { $addToSet: '$apiKeyId' },
                    },
                },
                {
                    $project: {
                        organization: '$_id',
                        requests: 1,
                        totalTokens: 1,
                        weightedTokens: 1,
                        keyCount: { $size: '$uniqueKeys' },
                    },
                },
                { $sort: { weightedTokens: -1 } },
                { $limit: 20 },
            ]),

            // By endpoint
            ApiKeyUsage.aggregate([
                { $match: { timestamp: { $gte: startDate } } },
                {
                    $group: {
                        _id: '$endpoint',
                        requests: { $sum: 1 },
                        totalTokens: { $sum: '$totalTokens' },
                    },
                },
                { $sort: { requests: -1 } },
            ]),
        ]);

        return { daily, topKeys, topOrgs, byEndpoint };
    }
}
