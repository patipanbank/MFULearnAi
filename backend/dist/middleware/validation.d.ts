import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
export interface ValidationSchema {
    params?: z.ZodSchema;
    query?: z.ZodSchema;
    body?: z.ZodSchema;
    headers?: z.ZodSchema;
}
export declare const validateRequest: (schema: z.ZodSchema | ValidationSchema) => (req: Request, res: Response, next: NextFunction) => void | Response<any, Record<string, any>>;
export declare const commonSchemas: {
    pagination: z.ZodObject<{
        limit: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, number, string>, number, string>>;
        offset: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, number, string>, number, string>>;
    }, "strip", z.ZodTypeAny, {
        limit?: number | undefined;
        offset?: number | undefined;
    }, {
        limit?: string | undefined;
        offset?: string | undefined;
    }>;
    mongoId: z.ZodString;
    dateRange: z.ZodEffects<z.ZodObject<{
        from: z.ZodOptional<z.ZodString>;
        to: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        to?: string | undefined;
        from?: string | undefined;
    }, {
        to?: string | undefined;
        from?: string | undefined;
    }>, {
        to?: string | undefined;
        from?: string | undefined;
    }, {
        to?: string | undefined;
        from?: string | undefined;
    }>;
    search: z.ZodObject<{
        query: z.ZodOptional<z.ZodString>;
        fields: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        caseSensitive: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        fields?: string[] | undefined;
        query?: string | undefined;
        caseSensitive?: boolean | undefined;
    }, {
        fields?: string[] | undefined;
        query?: string | undefined;
        caseSensitive?: boolean | undefined;
    }>;
};
export declare const handleValidationError: (error: z.ZodError) => {
    success: boolean;
    error: string;
    code: string;
    details: {
        field: string;
        message: string;
        code: "invalid_type" | "invalid_literal" | "unrecognized_keys" | "invalid_union" | "invalid_union_discriminator" | "invalid_enum_value" | "invalid_arguments" | "invalid_return_type" | "invalid_date" | "invalid_string" | "too_small" | "too_big" | "invalid_intersection_types" | "not_multiple_of" | "not_finite" | "custom";
        value: any;
    }[];
};
//# sourceMappingURL=validation.d.ts.map