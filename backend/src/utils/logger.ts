import winston from 'winston';

// สร้าง logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'mfulearnai-backend' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // File transport สำหรับ error
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport สำหรับ combined logs
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  ],
});

// ถ้าไม่ใช่ production ให้ log ไป console ด้วย
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// สร้าง custom log levels
export const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6
};

// สร้าง helper functions
export const logError = (message: string, error?: any, context?: any) => {
  logger.error(message, {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
    context
  });
};

export const logWarn = (message: string, context?: any) => {
  logger.warn(message, { context });
};

export const logInfo = (message: string, context?: any) => {
  logger.info(message, { context });
};

export const logDebug = (message: string, context?: any) => {
  logger.debug(message, { context });
};

// LangChain specific logging
export const logAgentEvent = (event: string, data?: any) => {
  logger.info(`Agent Event: ${event}`, { 
    event, 
    data,
    timestamp: new Date().toISOString()
  });
};

export const logToolUsage = (toolName: string, input: string, output: string, duration: number) => {
  logger.info(`Tool Usage: ${toolName}`, {
    toolName,
    input,
    output,
    duration,
    timestamp: new Date().toISOString()
  });
};

export const logChatEvent = (event: string, chatId: string, userId: string, data?: any) => {
  logger.info(`Chat Event: ${event}`, {
    event,
    chatId,
    userId,
    data,
    timestamp: new Date().toISOString()
  });
};

export const logPerformance = (operation: string, duration: number, metadata?: any) => {
  logger.info(`Performance: ${operation}`, {
    operation,
    duration,
    metadata,
    timestamp: new Date().toISOString()
  });
};

export default logger; 