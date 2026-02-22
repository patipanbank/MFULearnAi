import { Request, Response } from 'express';
import LogEntry, { LogEntryDocument } from '../infra/logger/models/LogEntry';
import AuditLog, { IAuditLog } from '../infra/logger/models/AuditLog';
import { Logger } from '../infra/logger';
import { QUOTA_CONFIG } from '../config/quotas';
import { MODEL_COST_WEIGHTS } from '../config/models';

const ENV_TYPE = (process.env.ENV_TYPE || 'TEST') as 'TEST' | 'PROD';
const RETENTION_POLICY = {
    TEST: {
        debug: 7,
        info: 30,
        warn: 60,
        error: 90,
        audit: 180
    },
    PROD: {
        debug: 0,
        info: 30,
        warn: 90,
        error: 365,
        audit: 730
    }
};

export class LogController {

    static async createLog(req: Request, res: Response) {
        try {
            const { level, service, userId, action, details } = req.body;

            if (!level || !service || !action) {
                return res.status(400).json({ error: 'Missing required log fields' });
            }

            // Using our new Logger infra which handles masking, retention, and dual-writing audit logs
            // We pass details directly; Logger handles masking based on ENV_TYPE
            await Logger.log(level, action, details, userId, service);

            res.status(201).json({ success: true });
        } catch (error: any) {
            console.error('[LogController] Error creating log:', error);
            res.status(500).json({ error: error.message });
        }
    }

    static async getLogs(req: Request, res: Response) {
        try {
            const {
                level,
                service,
                userId,
                action,
                startDate,
                endDate,
                page = '1',
                limit = '50'
            } = req.query;

            const query: any = {};

            if (level) query.level = level;
            if (service) query.service = service;
            if (userId) query.userId = userId;
            if (action) query.action = { $regex: action, $options: 'i' };

            if (startDate || endDate) {
                query.timestamp = {};
                if (startDate) query.timestamp.$gte = new Date(startDate as string);
                if (endDate) query.timestamp.$lte = new Date(endDate as string);
            }

            const pageNum = parseInt(page as string);
            const limitNum = Math.min(parseInt(limit as string), 100);
            const skip = (pageNum - 1) * limitNum;

            const logs = await LogEntry.find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limitNum);

            const total = await LogEntry.countDocuments(query);

            res.json({
                logs,
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getAuditLogs(req: Request, res: Response) {
        try {
            const {
                userId,
                action,
                startDate,
                endDate,
                page = '1',
                limit = '50'
            } = req.query;

            // Audit logs are environment specific usually, but here strict filtering
            const query: any = { environment: ENV_TYPE };

            if (userId) query.userId = userId;
            if (action) query.action = { $regex: action, $options: 'i' };

            if (startDate || endDate) {
                query.timestamp = {};
                if (startDate) query.timestamp.$gte = new Date(startDate as string);
                if (endDate) query.timestamp.$lte = new Date(endDate as string);
            }

            const pageNum = parseInt(page as string);
            const limitNum = Math.min(parseInt(limit as string), 100);
            const skip = (pageNum - 1) * limitNum;

            const logs = await AuditLog.find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limitNum);

            const total = await AuditLog.countDocuments(query);

            res.json({
                logs,
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum)
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getStats(req: Request, res: Response) {
        try {
            // Use string matching mostly, or ensure ENV_TYPE matches exactly what was saved
            const stats = await LogEntry.aggregate([
                { $match: { environment: ENV_TYPE } },
                {
                    $group: {
                        _id: { level: '$level', service: '$service' },
                        count: { $sum: 1 },
                        lastLog: { $max: '$timestamp' }
                    }
                },
                { $sort: { count: -1 } }
            ]);

            const totalLogs = await LogEntry.countDocuments({ environment: ENV_TYPE });
            const totalAuditLogs = await AuditLog.countDocuments({ environment: ENV_TYPE });

            res.json({
                stats,
                totalLogs,
                totalAuditLogs,
                environment: ENV_TYPE,
                retentionPolicy: RETENTION_POLICY[ENV_TYPE]
            });
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    }

    static async getUsage(req: Request, res: Response) {
        try {
            const TZ_OFFSET = 7 * 60 * 60 * 1000;
            const now = new Date();
            const bangkokNow = new Date(now.getTime() + TZ_OFFSET);

            const startOfDay = new Date(bangkokNow.getUTCFullYear(), bangkokNow.getUTCMonth(), bangkokNow.getUTCDate());
            const startOfDayUTC = new Date(startOfDay.getTime() - TZ_OFFSET);

            const sevenDaysAgo = new Date(startOfDayUTC);
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            // 1. Total & Today
            const [totalStats, todayStats] = await Promise.all([
                LogEntry.aggregate([
                    { $match: { action: 'chat_completion', environment: ENV_TYPE } },
                    { $group: { _id: null, totalTokens: { $sum: "$details.tokens.total" }, totalRequests: { $sum: 1 } } }
                ]),
                LogEntry.aggregate([
                    { $match: { action: 'chat_completion', environment: ENV_TYPE, timestamp: { $gte: startOfDayUTC } } },
                    {
                        $group: {
                            _id: null,
                            totalTokens: { $sum: "$details.tokens.total" },
                            totalRequests: { $sum: 1 },
                            uniqueUsers: { $addToSet: "$userId" }
                        }
                    }
                ])
            ]);

            // 2. Daily Trend (Last 7 Days)
            const dailyStats = await LogEntry.aggregate([
                { $match: { action: 'chat_completion', environment: ENV_TYPE, timestamp: { $gte: sevenDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp", timezone: "+07:00" } },
                        tokens: { $sum: "$details.tokens.total" },
                        requests: { $sum: 1 },
                        users: { $addToSet: "$userId" }
                    }
                },
                { $sort: { _id: 1 } }
            ]);

            // 3. Model Distribution
            const modelStats = await LogEntry.aggregate([
                { $match: { action: 'chat_completion', environment: ENV_TYPE } },
                {
                    $group: {
                        _id: "$details.model",
                        count: { $sum: 1 },
                        tokens: { $sum: "$details.tokens.total" }
                    }
                }
            ]);

            res.json({
                totals: {
                    tokens: totalStats[0]?.totalTokens || 0,
                    requests: totalStats[0]?.totalRequests || 0
                },
                today: {
                    tokens: todayStats[0]?.totalTokens || 0,
                    requests: todayStats[0]?.totalRequests || 0,
                    uniqueUsers: todayStats[0]?.uniqueUsers ? todayStats[0].uniqueUsers.length : 0
                },
                daily: dailyStats.map(d => ({
                    date: d._id,
                    tokens: d.tokens,
                    requests: d.requests,
                    uniqueUsers: d.users.length
                })),
                models: modelStats
            });

        } catch (error: any) {
            console.error('Usage stats error:', error);
            res.status(500).json({ error: 'Failed to fetch usage stats' });
        }
    }

    static async getUserUsage(req: Request, res: Response) {
        try {
            const { userId } = req.query;
            if (!userId) return res.status(400).json({ error: 'User ID required' });

            const TZ_OFFSET = 7 * 60 * 60 * 1000;
            const now = new Date();
            const bangkokNow = new Date(now.getTime() + TZ_OFFSET);
            const startOfDayUTC = new Date(new Date(bangkokNow.getUTCFullYear(), bangkokNow.getUTCMonth(), bangkokNow.getUTCDate()).getTime() - TZ_OFFSET);

            // Weighted token aggregation expression:
            // Use `details.weightedTokens` if present (new entries), otherwise fall back to raw tokens (migration-safe).
            const weightedTokenExpr = {
                $ifNull: [
                    "$details.weightedTokens",
                    {
                        $cond: [
                            { $eq: ["$action", "chat_completion"] },
                            { $ifNull: ["$details.tokens.total", 0] },
                            { $ifNull: ["$details.totalTokens", 0] }
                        ]
                    }
                ]
            };

            // Raw token expression (for observability — always shows true token count)
            const rawTokenExpr = {
                $cond: [
                    { $eq: ["$action", "chat_completion"] },
                    { $ifNull: ["$details.tokens.total", 0] },
                    { $ifNull: ["$details.totalTokens", 0] }
                ]
            };

            const matchFilter = {
                action: { $in: ['chat_completion', 'agent_reliability_telemetry'] },
                environment: ENV_TYPE,
                userId: userId
            };

            const [userTotal, userToday] = await Promise.all([
                // All Time for User
                LogEntry.aggregate([
                    { $match: matchFilter },
                    {
                        $group: {
                            _id: null,
                            tokens: { $sum: rawTokenExpr },
                            weightedTokens: { $sum: weightedTokenExpr },
                            requests: { $sum: 1 }
                        }
                    }
                ]),
                // Today for User
                LogEntry.aggregate([
                    { $match: { ...matchFilter, timestamp: { $gte: startOfDayUTC } } },
                    {
                        $group: {
                            _id: null,
                            tokens: { $sum: rawTokenExpr },
                            weightedTokens: { $sum: weightedTokenExpr },
                            requests: { $sum: 1 }
                        }
                    }
                ])
            ]);

            res.json({
                total: {
                    tokens: userTotal[0]?.tokens || 0,
                    weightedTokens: userTotal[0]?.weightedTokens || 0,
                    requests: userTotal[0]?.requests || 0
                },
                today: {
                    tokens: userToday[0]?.tokens || 0,
                    weightedTokens: userToday[0]?.weightedTokens || 0,
                    requests: userToday[0]?.requests || 0
                },
                quota: {
                    dailyLimit: QUOTA_CONFIG.DAILY_LIMIT,
                    warningThreshold: QUOTA_CONFIG.WARNING_THRESHOLD,
                    hardLimitEnabled: QUOTA_CONFIG.HARD_LIMIT_ENABLED
                }
            });

        } catch (error: any) {
            res.status(500).json({ error: 'Failed to fetch user usage' });
        }
    }

    /**
     * Returns quota configuration for the frontend.
     * The frontend fetches this once on mount instead of hardcoding limits.
     */
    static async getQuotaConfig(_req: Request, res: Response) {
        try {
            res.json({
                dailyLimit: QUOTA_CONFIG.DAILY_LIMIT,
                warningThreshold: QUOTA_CONFIG.WARNING_THRESHOLD,
                hardLimitEnabled: QUOTA_CONFIG.HARD_LIMIT_ENABLED,
                unitLabel: QUOTA_CONFIG.UNIT_LABEL,
                costWeights: MODEL_COST_WEIGHTS
            });
        } catch (error: any) {
            res.status(500).json({ error: 'Failed to fetch quota config' });
        }
    }
}
