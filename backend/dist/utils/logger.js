"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPerformance = exports.logChatEvent = exports.logToolUsage = exports.logAgentEvent = exports.logDebug = exports.logInfo = exports.logWarn = exports.logError = exports.logLevels = void 0;
const winston_1 = __importDefault(require("winston"));
const logger = winston_1.default.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }), winston_1.default.format.errors({ stack: true }), winston_1.default.format.json()),
    defaultMeta: { service: 'mfulearnai-backend' },
    transports: [
        new winston_1.default.transports.Console({
            format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple())
        }),
        new winston_1.default.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880,
            maxFiles: 5,
        }),
        new winston_1.default.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880,
            maxFiles: 5,
        })
    ],
});
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.simple()
    }));
}
exports.logLevels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
};
const logError = (message, error, context) => {
    logger.error(message, {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        context
    });
};
exports.logError = logError;
const logWarn = (message, context) => {
    logger.warn(message, { context });
};
exports.logWarn = logWarn;
const logInfo = (message, context) => {
    logger.info(message, { context });
};
exports.logInfo = logInfo;
const logDebug = (message, context) => {
    logger.debug(message, { context });
};
exports.logDebug = logDebug;
const logAgentEvent = (event, data) => {
    logger.info(`Agent Event: ${event}`, {
        event,
        data,
        timestamp: new Date().toISOString()
    });
};
exports.logAgentEvent = logAgentEvent;
const logToolUsage = (toolName, input, output, duration) => {
    logger.info(`Tool Usage: ${toolName}`, {
        toolName,
        input,
        output,
        duration,
        timestamp: new Date().toISOString()
    });
};
exports.logToolUsage = logToolUsage;
const logChatEvent = (event, chatId, userId, data) => {
    logger.info(`Chat Event: ${event}`, {
        event,
        chatId,
        userId,
        data,
        timestamp: new Date().toISOString()
    });
};
exports.logChatEvent = logChatEvent;
const logPerformance = (operation, duration, metadata) => {
    logger.info(`Performance: ${operation}`, {
        operation,
        duration,
        metadata,
        timestamp: new Date().toISOString()
    });
};
exports.logPerformance = logPerformance;
exports.default = logger;
//# sourceMappingURL=logger.js.map