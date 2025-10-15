import winston from 'winston';
import config from '../config/config';

/**
 * Winston Logger Configuration
 * Structured logging for production and development
 */

const logFormat = config.LOG_FORMAT === 'json'
  ? winston.format.json()
  : winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message} ${
          Object.keys(info).length > 3 ? JSON.stringify(info, null, 2) : ''
        }`
      )
    );

const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    logFormat
  ),
  defaultMeta: {
    service: 'chat-service',
    environment: config.APP_ENV,
  },
  transports: [
    new winston.transports.Console({
      format: logFormat,
    }),
  ],
});

// Add file transports in production
if (config.APP_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

export default logger;
