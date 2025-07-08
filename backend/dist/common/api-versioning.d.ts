import { VersioningType } from '@nestjs/common';
export interface ApiVersionConfig {
    type: VersioningType;
    defaultVersion?: string | string[];
    prefix?: string;
    header?: string;
    customExtractor?: (request: any) => string | string[] | undefined;
}
export declare class ApiVersioning {
    static getDefaultConfig(): ApiVersionConfig;
    static getHeaderConfig(header?: string): ApiVersionConfig;
    static getCustomConfig(extractor: (request: any) => string | string[] | undefined): ApiVersionConfig;
    static getMediaTypeConfig(): ApiVersionConfig;
    static queryParamExtractor(paramName?: string): (request: any) => any;
    static subdomainExtractor(): (request: any) => any;
    static acceptHeaderExtractor(): (request: any) => any;
}
export declare const ApiVersions: {
    readonly V1: "1";
    readonly V2: "2";
    readonly V3: "3";
    readonly LATEST: "3";
    readonly BETA: "beta";
    readonly ALPHA: "alpha";
};
export type ApiVersion = typeof ApiVersions[keyof typeof ApiVersions];
export declare const DeprecatedVersions: {
    readonly V1: {
        readonly version: "1";
        readonly deprecatedAt: "2024-01-01";
        readonly sunsetAt: "2024-12-31";
        readonly message: "API v1 is deprecated. Please migrate to v2 or higher.";
    };
};
export declare const VersionCompatibility: {
    readonly '1': {
        readonly supportedUntil: "2024-12-31";
        readonly recommendedMigration: "2";
        readonly features: readonly ["basic-auth", "simple-chat"];
    };
    readonly '2': {
        readonly supportedUntil: "2025-12-31";
        readonly recommendedMigration: "3";
        readonly features: readonly ["jwt-auth", "advanced-chat", "file-upload"];
    };
    readonly '3': {
        readonly supportedUntil: "2026-12-31";
        readonly recommendedMigration: null;
        readonly features: readonly ["oauth2", "websocket", "ai-agents", "real-time-collaboration"];
    };
    readonly beta: {
        readonly supportedUntil: "2024-06-30";
        readonly recommendedMigration: "3";
        readonly features: readonly ["experimental-features"];
    };
};
export declare function getVersionInfo(version: string): {
    readonly supportedUntil: "2024-12-31";
    readonly recommendedMigration: "2";
    readonly features: readonly ["basic-auth", "simple-chat"];
} | {
    readonly supportedUntil: "2025-12-31";
    readonly recommendedMigration: "3";
    readonly features: readonly ["jwt-auth", "advanced-chat", "file-upload"];
} | {
    readonly supportedUntil: "2026-12-31";
    readonly recommendedMigration: null;
    readonly features: readonly ["oauth2", "websocket", "ai-agents", "real-time-collaboration"];
} | {
    readonly supportedUntil: "2024-06-30";
    readonly recommendedMigration: "3";
    readonly features: readonly ["experimental-features"];
};
export declare function isVersionDeprecated(version: string): boolean;
export declare function getDeprecationWarning(version: string): string | null;
