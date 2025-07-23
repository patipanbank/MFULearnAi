import { Request, Response, NextFunction } from 'express';
import { ZodObject } from 'zod';
export declare const validate: (schema: ZodObject<any>) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const validateBody: (schema: ZodObject<any>) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const validateQuery: (schema: ZodObject<any>) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=validation.d.ts.map