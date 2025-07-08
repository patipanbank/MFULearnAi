import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
export interface SecurityHeadersConfig {
    contentSecurityPolicy?: {
        directives?: {
            defaultSrc?: string[];
            scriptSrc?: string[];
            styleSrc?: string[];
            fontSrc?: string[];
            imgSrc?: string[];
            connectSrc?: string[];
            mediaSrc?: string[];
            objectSrc?: string[];
            childSrc?: string[];
            frameSrc?: string[];
            workerSrc?: string[];
            frameAncestors?: string[];
            formAction?: string[];
            upgradeInsecureRequests?: boolean;
            blockAllMixedContent?: boolean;
        };
        reportOnly?: boolean;
    };
    hsts?: {
        maxAge?: number;
        includeSubDomains?: boolean;
        preload?: boolean;
    };
    frameOptions?: 'DENY' | 'SAMEORIGIN' | 'ALLOW-FROM' | false;
    noSniff?: boolean;
    xssProtection?: boolean;
    referrerPolicy?: 'no-referrer' | 'no-referrer-when-downgrade' | 'origin' | 'origin-when-cross-origin' | 'same-origin' | 'strict-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
    permissionsPolicy?: Record<string, string[]>;
    removeServerHeader?: boolean;
    removePoweredBy?: boolean;
    customHeaders?: Record<string, string>;
}
export declare class SecurityHeadersMiddleware implements NestMiddleware {
    private readonly logger;
    private readonly defaultConfig;
    use(req: Request, res: Response, next: NextFunction): void;
    static create(config: Partial<SecurityHeadersConfig>): (req: Request, res: Response, next: NextFunction) => void;
    private applySecurityHeaders;
    private buildCSP;
    private buildHSTS;
    private buildPermissionsPolicy;
    private generateRequestId;
}
export declare class SecurityHeadersPresets {
    static strict(): (req: Request, res: Response, next: NextFunction) => void;
    static moderate(): (req: Request, res: Response, next: NextFunction) => void;
    static api(): (req: Request, res: Response, next: NextFunction) => void;
    static minimal(): (req: Request, res: Response, next: NextFunction) => void;
}
