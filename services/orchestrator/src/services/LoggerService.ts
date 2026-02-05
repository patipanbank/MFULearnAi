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
            console.error('[LoggerService] Failed to log:', err);
        }
    }
}
