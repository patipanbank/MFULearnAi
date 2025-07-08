"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var SecurityHeadersMiddleware_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityHeadersPresets = exports.SecurityHeadersMiddleware = void 0;
const common_1 = require("@nestjs/common");
let SecurityHeadersMiddleware = SecurityHeadersMiddleware_1 = class SecurityHeadersMiddleware {
    constructor() {
        this.logger = new common_1.Logger(SecurityHeadersMiddleware_1.name);
        this.defaultConfig = {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    fontSrc: ["'self'", 'data:', 'https:'],
                    imgSrc: ["'self'", 'data:', 'https:'],
                    connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
                    mediaSrc: ["'self'"],
                    objectSrc: ["'none'"],
                    childSrc: ["'self'"],
                    frameSrc: ["'self'"],
                    workerSrc: ["'self'"],
                    frameAncestors: ["'self'"],
                    formAction: ["'self'"],
                    upgradeInsecureRequests: true,
                    blockAllMixedContent: true
                },
                reportOnly: false
            },
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            },
            frameOptions: 'DENY',
            noSniff: true,
            xssProtection: true,
            referrerPolicy: 'strict-origin-when-cross-origin',
            permissionsPolicy: {
                'camera': [],
                'microphone': [],
                'geolocation': [],
                'payment': [],
                'usb': [],
                'magnetometer': [],
                'gyroscope': [],
                'accelerometer': []
            },
            removeServerHeader: true,
            removePoweredBy: true,
            customHeaders: {
                'X-API-Version': '1.0',
                'X-Request-ID': ''
            }
        };
    }
    use(req, res, next) {
        this.applySecurityHeaders(req, res, next, this.defaultConfig);
    }
    static create(config) {
        return (req, res, next) => {
            const middleware = new SecurityHeadersMiddleware_1();
            const finalConfig = { ...middleware.defaultConfig, ...config };
            middleware.applySecurityHeaders(req, res, next, finalConfig);
        };
    }
    applySecurityHeaders(req, res, next, config) {
        try {
            if (config.contentSecurityPolicy) {
                const csp = this.buildCSP(config.contentSecurityPolicy);
                const headerName = config.contentSecurityPolicy.reportOnly
                    ? 'Content-Security-Policy-Report-Only'
                    : 'Content-Security-Policy';
                res.setHeader(headerName, csp);
            }
            if (config.hsts && req.secure) {
                const hsts = this.buildHSTS(config.hsts);
                res.setHeader('Strict-Transport-Security', hsts);
            }
            if (config.frameOptions) {
                res.setHeader('X-Frame-Options', config.frameOptions);
            }
            if (config.noSniff) {
                res.setHeader('X-Content-Type-Options', 'nosniff');
            }
            if (config.xssProtection) {
                res.setHeader('X-XSS-Protection', '1; mode=block');
            }
            if (config.referrerPolicy) {
                res.setHeader('Referrer-Policy', config.referrerPolicy);
            }
            if (config.permissionsPolicy) {
                const permissionsPolicy = this.buildPermissionsPolicy(config.permissionsPolicy);
                res.setHeader('Permissions-Policy', permissionsPolicy);
            }
            if (config.removeServerHeader) {
                res.removeHeader('Server');
            }
            if (config.removePoweredBy) {
                res.removeHeader('X-Powered-By');
            }
            if (config.customHeaders) {
                Object.entries(config.customHeaders).forEach(([key, value]) => {
                    if (key === 'X-Request-ID') {
                        const requestId = this.generateRequestId();
                        res.setHeader(key, requestId);
                        req.requestId = requestId;
                    }
                    else if (value) {
                        res.setHeader(key, value);
                    }
                });
            }
            res.setHeader('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            this.logger.debug(`Security headers applied for ${req.method} ${req.url}`);
            next();
        }
        catch (error) {
            this.logger.error('Error applying security headers:', error);
            next();
        }
    }
    buildCSP(csp) {
        if (!csp || !csp.directives)
            return '';
        const directives = [];
        Object.entries(csp.directives).forEach(([key, value]) => {
            if (key === 'upgradeInsecureRequests' && value) {
                directives.push('upgrade-insecure-requests');
            }
            else if (key === 'blockAllMixedContent' && value) {
                directives.push('block-all-mixed-content');
            }
            else if (Array.isArray(value)) {
                const directive = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                directives.push(`${directive} ${value.join(' ')}`);
            }
        });
        return directives.join('; ');
    }
    buildHSTS(hsts) {
        if (!hsts)
            return '';
        let value = `max-age=${hsts.maxAge || 31536000}`;
        if (hsts.includeSubDomains) {
            value += '; includeSubDomains';
        }
        if (hsts.preload) {
            value += '; preload';
        }
        return value;
    }
    buildPermissionsPolicy(policy) {
        const directives = [];
        Object.entries(policy).forEach(([feature, allowlist]) => {
            if (allowlist.length === 0) {
                directives.push(`${feature}=()`);
            }
            else {
                const origins = allowlist.map(origin => origin === 'self' ? 'self' : `"${origin}"`).join(' ');
                directives.push(`${feature}=(${origins})`);
            }
        });
        return directives.join(', ');
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
};
exports.SecurityHeadersMiddleware = SecurityHeadersMiddleware;
exports.SecurityHeadersMiddleware = SecurityHeadersMiddleware = SecurityHeadersMiddleware_1 = __decorate([
    (0, common_1.Injectable)()
], SecurityHeadersMiddleware);
class SecurityHeadersPresets {
    static strict() {
        return SecurityHeadersMiddleware.create({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'"],
                    fontSrc: ["'self'"],
                    imgSrc: ["'self'", 'data:'],
                    connectSrc: ["'self'"],
                    mediaSrc: ["'none'"],
                    objectSrc: ["'none'"],
                    childSrc: ["'none'"],
                    frameSrc: ["'none'"],
                    workerSrc: ["'self'"],
                    frameAncestors: ["'none'"],
                    formAction: ["'self'"],
                    upgradeInsecureRequests: true,
                    blockAllMixedContent: true
                }
            },
            frameOptions: 'DENY',
            removeServerHeader: true,
            removePoweredBy: true
        });
    }
    static moderate() {
        return SecurityHeadersMiddleware.create({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'", "'unsafe-inline'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    fontSrc: ["'self'", 'data:', 'https:'],
                    imgSrc: ["'self'", 'data:', 'https:'],
                    connectSrc: ["'self'", 'https:', 'wss:', 'ws:'],
                    frameAncestors: ["'self'"]
                }
            },
            frameOptions: 'SAMEORIGIN',
            removeServerHeader: true,
            removePoweredBy: true
        });
    }
    static api() {
        return SecurityHeadersMiddleware.create({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    connectSrc: ["'self'", 'https:', 'wss:', 'ws:']
                }
            },
            frameOptions: 'DENY',
            noSniff: true,
            xssProtection: true,
            removeServerHeader: true,
            removePoweredBy: true,
            customHeaders: {
                'X-API-Version': '1.0',
                'X-Request-ID': ''
            }
        });
    }
    static minimal() {
        return SecurityHeadersMiddleware.create({
            removeServerHeader: true,
            removePoweredBy: true,
            customHeaders: {
                'X-Health-Check': 'true'
            }
        });
    }
}
exports.SecurityHeadersPresets = SecurityHeadersPresets;
//# sourceMappingURL=security-headers.middleware.js.map