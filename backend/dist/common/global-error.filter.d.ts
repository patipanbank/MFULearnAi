import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
export declare class GlobalErrorFilter implements ExceptionFilter {
    private readonly logger;
    catch(exception: unknown, host: ArgumentsHost): void;
    private handleHttpException;
    private handleMongoError;
    private handleGenericError;
    private handleUnknownError;
    private logError;
    private recordErrorMetrics;
    private getClientIp;
    private isMongoError;
}
