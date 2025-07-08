"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionCompatibility = exports.DeprecatedVersions = exports.ApiVersions = exports.ApiVersioning = void 0;
exports.getVersionInfo = getVersionInfo;
exports.isVersionDeprecated = isVersionDeprecated;
exports.getDeprecationWarning = getDeprecationWarning;
const common_1 = require("@nestjs/common");
class ApiVersioning {
    static getDefaultConfig() {
        return {
            type: common_1.VersioningType.URI,
            defaultVersion: '1',
            prefix: 'v',
        };
    }
    static getHeaderConfig(header = 'X-API-Version') {
        return {
            type: common_1.VersioningType.HEADER,
            defaultVersion: '1',
            header,
        };
    }
    static getCustomConfig(extractor) {
        return {
            type: common_1.VersioningType.CUSTOM,
            defaultVersion: '1',
            customExtractor: extractor,
        };
    }
    static getMediaTypeConfig() {
        return {
            type: common_1.VersioningType.MEDIA_TYPE,
            defaultVersion: '1',
        };
    }
    static queryParamExtractor(paramName = 'version') {
        return (request) => {
            var _a;
            return (_a = request.query) === null || _a === void 0 ? void 0 : _a[paramName];
        };
    }
    static subdomainExtractor() {
        return (request) => {
            const host = request.headers.host;
            if (!host)
                return undefined;
            const parts = host.split('.');
            if (parts.length > 2) {
                const subdomain = parts[0];
                const versionMatch = subdomain.match(/^v(\d+)$/);
                return versionMatch ? versionMatch[1] : undefined;
            }
            return undefined;
        };
    }
    static acceptHeaderExtractor() {
        return (request) => {
            const accept = request.headers.accept;
            if (!accept)
                return undefined;
            const versionMatch = accept.match(/application\/vnd\.mfu\.v(\d+)\+json/);
            return versionMatch ? versionMatch[1] : undefined;
        };
    }
}
exports.ApiVersioning = ApiVersioning;
exports.ApiVersions = {
    V1: '1',
    V2: '2',
    V3: '3',
    LATEST: '3',
    BETA: 'beta',
    ALPHA: 'alpha',
};
exports.DeprecatedVersions = {
    V1: {
        version: '1',
        deprecatedAt: '2024-01-01',
        sunsetAt: '2024-12-31',
        message: 'API v1 is deprecated. Please migrate to v2 or higher.',
    },
};
exports.VersionCompatibility = {
    '1': {
        supportedUntil: '2024-12-31',
        recommendedMigration: '2',
        features: ['basic-auth', 'simple-chat'],
    },
    '2': {
        supportedUntil: '2025-12-31',
        recommendedMigration: '3',
        features: ['jwt-auth', 'advanced-chat', 'file-upload'],
    },
    '3': {
        supportedUntil: '2026-12-31',
        recommendedMigration: null,
        features: ['oauth2', 'websocket', 'ai-agents', 'real-time-collaboration'],
    },
    'beta': {
        supportedUntil: '2024-06-30',
        recommendedMigration: '3',
        features: ['experimental-features'],
    },
};
function getVersionInfo(version) {
    return exports.VersionCompatibility[version];
}
function isVersionDeprecated(version) {
    const versionInfo = getVersionInfo(version);
    if (!versionInfo)
        return false;
    const supportedUntil = new Date(versionInfo.supportedUntil);
    const now = new Date();
    return now > supportedUntil;
}
function getDeprecationWarning(version) {
    const versionInfo = getVersionInfo(version);
    if (!versionInfo)
        return null;
    const supportedUntil = new Date(versionInfo.supportedUntil);
    const now = new Date();
    const daysUntilSunset = Math.ceil((supportedUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilSunset <= 90 && daysUntilSunset > 0) {
        return `API version ${version} will be deprecated in ${daysUntilSunset} days. Please migrate to version ${versionInfo.recommendedMigration}.`;
    }
    if (daysUntilSunset <= 0) {
        return `API version ${version} is deprecated. Please migrate to version ${versionInfo.recommendedMigration}.`;
    }
    return null;
}
//# sourceMappingURL=api-versioning.js.map