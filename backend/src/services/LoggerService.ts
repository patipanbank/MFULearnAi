import { Logger } from '../infra/logger';

export class LoggerService {
    static async log(
        level: 'debug' | 'info' | 'warn' | 'error' | 'audit',
        action: string,
        context: any,
        userId?: string
    ) {
        return Logger.log(level, action, context, userId, 'backend');
    }

    static async info(action: string, context?: any, userId?: string) {
        return Logger.info(action, context, userId);
    }

    static async warn(action: string, context?: any, userId?: string) {
        return Logger.warn(action, context, userId);
    }

    static async error(action: string, context?: any, userId?: string) {
        return Logger.error(action, context, userId);
    }

    static async audit(action: string, context?: any, userId?: string) {
        return Logger.audit(action, context, userId);
    }

    static async debug(action: string, context?: any, userId?: string) {
        return Logger.debug(action, context, userId);
    }
}
