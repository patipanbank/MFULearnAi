import winston from 'winston';
declare const logger: winston.Logger;
export declare const logLevels: {
    error: number;
    warn: number;
    info: number;
    http: number;
    verbose: number;
    debug: number;
    silly: number;
};
export declare const logError: (message: string, error?: any, context?: any) => void;
export declare const logWarn: (message: string, context?: any) => void;
export declare const logInfo: (message: string, context?: any) => void;
export declare const logDebug: (message: string, context?: any) => void;
export declare const logAgentEvent: (event: string, data?: any) => void;
export declare const logToolUsage: (toolName: string, input: string, output: string, duration: number) => void;
export declare const logChatEvent: (event: string, chatId: string, userId: string, data?: any) => void;
export declare const logPerformance: (operation: string, duration: number, metadata?: any) => void;
export default logger;
//# sourceMappingURL=logger.d.ts.map