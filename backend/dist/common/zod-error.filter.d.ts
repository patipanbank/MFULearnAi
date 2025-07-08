import { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import { ZodError } from 'zod';
export declare class ZodErrorFilter implements ExceptionFilter {
    catch(exception: ZodError, host: ArgumentsHost): void;
}
