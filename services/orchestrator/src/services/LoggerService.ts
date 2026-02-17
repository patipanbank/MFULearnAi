import axios from 'axios';

const LOGGER_URL = process.env.LOGGER_URL || 'http://localhost:6000/api/logs';
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';

export class LoggerService {
    // Circuit breaker: stop calling logger after repeated failures
    private static failCount = 0;
    private static readonly MAX_FAILURES = 5;
    private static circuitOpenUntil = 0;
    private static readonly CIRCUIT_RESET_MS = 60_000; // 60 seconds

    private static isCircuitOpen(): boolean {
        if (this.failCount < this.MAX_FAILURES) return false;
        if (Date.now() > this.circuitOpenUntil) {
            // Half-open: allow one attempt
            this.failCount = 0;
            return false;
        }
        return true;
    }

    static async log(
        level: 'debug' | 'info' | 'warn' | 'error' | 'audit',
        action: string,
        context: any,
        userId?: string
    ) {
        // Always output to console for immediate visibility
        if (level === 'error' || level === 'warn') {
            console.error(`[LoggerService:${level.toUpperCase()}] ${action}`, context);
        } else {
            console.log(`[LoggerService:${level.toUpperCase()}] ${action}`, context);
        }

        if (this.isCircuitOpen()) return; // Circuit is open — skip

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
            this.failCount = 0; // Reset on success
        } catch (err) {
            this.failCount++;
            if (this.failCount >= this.MAX_FAILURES) {
                this.circuitOpenUntil = Date.now() + this.CIRCUIT_RESET_MS;
                console.error(`[LoggerService] Circuit breaker OPEN after ${this.MAX_FAILURES} failures. Retrying in ${this.CIRCUIT_RESET_MS / 1000}s`);
            }
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
}
