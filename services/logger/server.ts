import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import LogEntry from './models/LogEntry';
import AuditLog from './models/AuditLog';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mful-logs';
const ENV_TYPE = (process.env.ENV_TYPE || 'TEST') as 'TEST' | 'PROD';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Retention policy (days)
const RETENTION_POLICY = {
    TEST: {
        debug: 7,
        info: 30,
        warn: 60,
        error: 90,
        audit: 180
    },
    PROD: {
        debug: 0, // Don't store debug in prod
        info: 30,
        warn: 90,
        error: 365,
        audit: 730 // 2 years for PDPA compliance
    }
};

// PDPA-sensitive fields to mask in production
const SENSITIVE_FIELDS = [
    'password', 'token', 'secret', 'accessToken', 'refreshToken',
    'nationalId', 'idCard', 'passport', 'bankAccount', 'creditCard',
    'phoneNumber', 'mobilePhone', 'address', 'dateOfBirth'
];

mongoose.connect(MONGO_URI)
    .then(() => console.log(`[Logger Service] Connected to MongoDB (${ENV_TYPE})`))
    .catch(err => console.error('[Logger Service] MongoDB error', err));

/**
 * Mask sensitive data for PDPA compliance
 */
const maskSensitiveData = (data: any, inProduction: boolean): any => {
    if (!inProduction || !data) return data;

    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
        return data.map(item => maskSensitiveData(item, inProduction));
    }

    const masked: any = {};
    for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();

        if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
            masked[key] = typeof value === 'string'
                ? `***MASKED(${value.length})***`
                : '***MASKED***';
        } else if (typeof value === 'object') {
            masked[key] = maskSensitiveData(value, inProduction);
        } else {
            masked[key] = value;
        }
    }

    return masked;
};

/**
 * Get retention days based on level and environment
 */
const getRetentionDays = (level: string): number => {
    const policy = RETENTION_POLICY[ENV_TYPE];
    return policy[level as keyof typeof policy] || 30;
};

// --- Log Entry Endpoint ---
app.post('/api/logs', async (req: Request, res: Response) => {
    try {
        const { level, service, userId, action, details, environment } = req.body;
        console.log(`[LoggerService] Incoming Log: ${action} [${service}]`);

        if (!level || !service || !action) {
            return res.status(400).json({ error: 'Missing required log fields' });
        }

        // Skip debug logs in production
        if (ENV_TYPE === 'PROD' && level === 'debug') {
            return res.status(200).json({ success: true, skipped: true });
        }

        const retentionDays = getRetentionDays(level);
        const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

        // Mask sensitive data in production
        const maskedDetails = maskSensitiveData(details, ENV_TYPE === 'PROD');

        const log = new LogEntry({
            level,
            service,
            userId,
            action,
            details: maskedDetails,
            environment: environment || ENV_TYPE,
            timestamp: new Date(),
            retentionDays,
            expiresAt
        });

        await log.save();

        // Also create audit log for audit-level events
        if (level === 'audit') {
            const auditLog = new AuditLog({
                userId,
                action,
                resource: service,
                environment: environment || ENV_TYPE,
                ipAddress: details?.ipAddress || req.ip || 'unknown',
                userAgent: details?.userAgent || req.headers['user-agent'] || 'unknown',
                details: maskedDetails,
                outcome: details?.outcome || 'success',
                retentionDays,
                expiresAt
            });
            await auditLog.save();
        }

        res.status(201).json({ success: true, logId: log._id });
    } catch (error: any) {
        console.error('[Logger] Logging error:', error);
        res.status(500).json({ error: error.message });
    }
});

// --- Query Logs (Admin) ---
app.get('/api/logs', async (req: Request, res: Response) => {
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
});

// --- Query Audit Logs (Admin) ---
app.get('/api/logs/audit', async (req: Request, res: Response) => {
    try {
        const {
            userId,
            action,
            startDate,
            endDate,
            page = '1',
            limit = '50'
        } = req.query;

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
});

// --- Stats Endpoint ---
app.get('/api/logs/stats', async (req: Request, res: Response) => {
    try {
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
});

// --- Usage Dashboard Stats (Tokens, Users) ---
app.get('/api/logs/usage', async (req: Request, res: Response) => {
    try {
        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);

        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        sevenDaysAgo.setHours(0, 0, 0, 0);

        // 1. Total & Today
        const [totalStats, todayStats] = await Promise.all([
            LogEntry.aggregate([
                { $match: { action: 'chat_completion', environment: ENV_TYPE } },
                { $group: { _id: null, totalTokens: { $sum: "$details.tokens.total" }, totalRequests: { $sum: 1 } } }
            ]),
            LogEntry.aggregate([
                { $match: { action: 'chat_completion', environment: ENV_TYPE, timestamp: { $gte: startOfDay } } },
                {
                    $group: {
                        _id: null,
                        totalTokens: { $sum: "$details.tokens.total" },
                        totalRequests: { $sum: 1 },
                        users: { $addToSet: "$userId" }
                    }
                }
            ])
        ]);

        // 2. Daily Trend (Last 7 Days)
        const dailyStats = await LogEntry.aggregate([
            { $match: { action: 'chat_completion', environment: ENV_TYPE, timestamp: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
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
                uniqueUsers: todayStats[0]?.users?.length || 0
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
});

// --- User Personal Usage Stats ---
app.get('/api/logs/usage/me', async (req: Request, res: Response) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: 'User ID required' });

        const now = new Date();
        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);

        // Aggregate User Stats
        const [userTotal, userToday] = await Promise.all([
            // All Time for User
            LogEntry.aggregate([
                {
                    $match: {
                        action: { $in: ['chat_completion', 'agent_reliability_telemetry'] },
                        environment: ENV_TYPE,
                        userId: userId
                    }
                },
                {
                    $group: {
                        _id: null,
                        tokens: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$action", "chat_completion"] },
                                    { $ifNull: ["$details.tokens.total", 0] },
                                    { $ifNull: ["$details.totalTokens", 0] }
                                ]
                            }
                        },
                        requests: { $sum: 1 }
                    }
                }
            ]),
            // Today for User
            LogEntry.aggregate([
                {
                    $match: {
                        action: { $in: ['chat_completion', 'agent_reliability_telemetry'] },
                        environment: ENV_TYPE,
                        userId: userId,
                        timestamp: { $gte: startOfDay }
                    }
                },
                {
                    $group: {
                        _id: null,
                        tokens: {
                            $sum: {
                                $cond: [
                                    { $eq: ["$action", "chat_completion"] },
                                    { $ifNull: ["$details.tokens.total", 0] },
                                    { $ifNull: ["$details.totalTokens", 0] }
                                ]
                            }
                        },
                        requests: { $sum: 1 }
                    }
                }
            ])
        ]);

        res.json({
            total: {
                tokens: userTotal[0]?.tokens || 0,
                requests: userTotal[0]?.requests || 0
            },
            today: {
                tokens: userToday[0]?.tokens || 0,
                requests: userToday[0]?.requests || 0
            }
        });

    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch user usage' });
    }
});

// --- Health Check ---
app.get('/health', (req: Request, res: Response) => res.json({
    status: 'ok',
    service: 'logger-service',
    environment: ENV_TYPE,
    pdpaCompliant: ENV_TYPE === 'PROD'
}));

const PORT = process.env.PORT || 6000;
app.listen(PORT, () => {
    console.log(`[Logger Service] Running on port ${PORT} [Env: ${ENV_TYPE}]`);
});
