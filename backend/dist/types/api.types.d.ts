export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    code?: string;
    message?: string;
    details?: any;
    meta?: {
        timestamp?: string;
        requestId?: string;
        version?: string;
        [key: string]: any;
    };
}
export interface ApiListResponse<T = any> extends ApiResponse<T[]> {
    meta: {
        total: number;
        limit?: number | null;
        offset?: number;
        page?: number;
        hasNext?: boolean;
        hasPrev?: boolean;
        timestamp?: string;
        requestId?: string;
        version?: string;
    };
}
export interface ApiErrorResponse extends ApiResponse<never> {
    success: false;
    error: string;
    code: string;
    details?: any[];
    stack?: string;
}
export declare const API_ERROR_CODES: {
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly FORBIDDEN: "FORBIDDEN";
    readonly TOKEN_EXPIRED: "TOKEN_EXPIRED";
    readonly INVALID_CREDENTIALS: "INVALID_CREDENTIALS";
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly INVALID_INPUT: "INVALID_INPUT";
    readonly MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly ALREADY_EXISTS: "ALREADY_EXISTS";
    readonly RESOURCE_CONFLICT: "RESOURCE_CONFLICT";
    readonly OPERATION_FAILED: "OPERATION_FAILED";
    readonly INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly QUOTA_EXCEEDED: "QUOTA_EXCEEDED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
    readonly SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE";
    readonly DATABASE_ERROR: "DATABASE_ERROR";
    readonly EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR";
    readonly CHAT_NOT_FOUND: "CHAT_NOT_FOUND";
    readonly MESSAGE_SEND_ERROR: "MESSAGE_SEND_ERROR";
    readonly AGENT_EXECUTION_ERROR: "AGENT_EXECUTION_ERROR";
    readonly WEBSOCKET_CONNECTION_ERROR: "WEBSOCKET_CONNECTION_ERROR";
};
export type ApiErrorCode = typeof API_ERROR_CODES[keyof typeof API_ERROR_CODES];
export declare const getHttpStatusForErrorCode: (code: ApiErrorCode) => number;
export interface PaginationQuery {
    limit?: number;
    offset?: number;
    page?: number;
}
export interface SearchQuery {
    query?: string;
    fields?: string[];
    caseSensitive?: boolean;
}
export interface DateRangeQuery {
    from?: string;
    to?: string;
}
export interface SortQuery {
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}
export type CommonQuery = PaginationQuery & SearchQuery & DateRangeQuery & SortQuery;
//# sourceMappingURL=api.types.d.ts.map