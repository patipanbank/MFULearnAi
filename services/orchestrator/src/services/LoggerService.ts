import axios from '../config/axios';

const LOGGER_URL = process.env.LOGGER_URL || 'http://localhost:6000/api/logs';
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';

export class LoggerService {
    static async log(
        level: 'debug' | 'info' | 'warn' | 'error' | 'audit',
        action: string,
        context: any,
        userId?: string
    ) {
        try {
            // Also log to console for local debugging
            const logMsg = `[${level.toUpperCase()}] [${action}] ${JSON.stringify(context || {})}`;
            if (level === 'error') console.error(logMsg);
            else if (level === 'warn') console.warn(logMsg);
            else console.log(logMsg);

            await axios.post(LOGGER_URL, {
                level,
                service: 'orchestrator',
                userId,
                action,
                details: context,
                environment: ENV_TYPE,
                timestamp: new Date().toISOString()
            });
        } catch (err) {
            // If external logger fails, we still have the console log above (except for the error itself)
            console.error('[LoggerService] Failed to send log to aggregator:', err);
        }
    }

    static async info(action: string, context?: any, userId?: string) {
        return this.log('info', action, context, userId);
    }

    static async warn(action: string, context?: any, userId?: string) {
        return this.log('warn', action, context, userId);
    }

    static async error(action: string, context?: any, userId?: string) {
        return this.log('error', action, context, userId);
    }

    // R6.1: Full Execution Trace Logging
    static async logTrace(trace: any, userId: string) {
        return this.log('audit', 'agent_execution_trace', trace, userId);
    }
}
