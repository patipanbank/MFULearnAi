import { LoggerService, LogLevel } from '@nestjs/common';
export declare class AppLogger implements LoggerService {
    private readonly logger;
    log(message: any, ...optionalParams: any[]): void;
    error(message: any, ...optionalParams: any[]): void;
    warn(message: any, ...optionalParams: any[]): void;
    debug?(message: any, ...optionalParams: any[]): void;
    verbose?(message: any, ...optionalParams: any[]): void;
    setLogLevels?(levels: LogLevel[]): void;
}
