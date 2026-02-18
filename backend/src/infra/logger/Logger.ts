import LogEntry from './models/LogEntry';
import AuditLog from './models/AuditLog';

const ENV_TYPE = (process.env.ENV_TYPE || 'TEST') as 'TEST' | 'PROD';

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

/**
 * Mask sensitive data for PDPA compliance
 */
const maskSensitiveData = (data: any, inProduction: boolean): any => {
    if (!inProduction || !data) return data;

    if (typeof data !== 'object') return data;

    if (Array.isArray(data)) {
        return data.map((item: any) => maskSensitiveData(item, inProduction));
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

export class Logger {

    static async log(
        level: 'debug' | 'info' | 'warn' | 'error' | 'audit',
        action: string,
        details?: any,
        userId?: string,
        service: string = 'backend'
    ) {
        // Skip debug logs in production
        if (ENV_TYPE === 'PROD' && level === 'debug') {
            return;
        }

        try {
            const retentionDays = getRetentionDays(level);
            const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);

            // Mask sensitive data
            const maskedDetails = maskSensitiveData(details, ENV_TYPE === 'PROD');

            const logEntry = new LogEntry({
                level,
                service,
                userId,
                action,
                details: maskedDetails,
                environment: ENV_TYPE,
                timestamp: new Date(),
                retentionDays,
                expiresAt
            });

            await logEntry.save();

            // Also create audit log for audit-level events
            if (level === 'audit') {
                const auditLog = new AuditLog({
                    userId,
                    action,
                    resource: service,
                    environment: ENV_TYPE,
                    ipAddress: 'internal', // Consolidate logic might miss context req
                    userAgent: 'internal',
                    details: maskedDetails,
                    outcome: details?.outcome || 'success',
                    retentionDays,
                    expiresAt
                });
                await auditLog.save();
            }

        } catch (error) {
            // Fallback to console if DB fails
            console.error('[Logger] Failed to save log:', error);
        }
    }

    static async debug(action: string, details?: any, userId?: string) {
        console.debug(`[DEBUG] ${action}`, details);
        return this.log('debug', action, details, userId);
    }

    static async info(action: string, details?: any, userId?: string) {
        console.log(`[INFO] ${action}`, details);
        return this.log('info', action, details, userId);
    }

    static async warn(action: string, details?: any, userId?: string) {
        console.warn(`[WARN] ${action}`, details);
        return this.log('warn', action, details, userId);
    }

    static async error(action: string, details?: any, userId?: string) {
        console.error(`[ERROR] ${action}`, details);
        return this.log('error', action, details, userId);
    }

    static async audit(action: string, details?: any, userId?: string) {
        console.log(`[AUDIT] ${action}`, details);
        return this.log('audit', action, details, userId);
    }
}
