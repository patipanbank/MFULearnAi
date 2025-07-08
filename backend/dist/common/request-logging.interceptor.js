"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestLoggingInterceptor = void 0;
const common_1 = require("@nestjs/common");
const operators_1 = require("rxjs/operators");
let RequestLoggingInterceptor = class RequestLoggingInterceptor {
    constructor() {
        this.logger = new common_1.Logger('RequestLogging');
    }
    intercept(context, next) {
        var _a;
        const request = context.switchToHttp().getRequest();
        const response = context.switchToHttp().getResponse();
        const startTime = Date.now();
        const { method, url, headers, body, query, params } = request;
        const userAgent = headers['user-agent'] || 'Unknown';
        const ip = this.getClientIp(request);
        const userId = ((_a = request.user) === null || _a === void 0 ? void 0 : _a.id) || 'Anonymous';
        this.logger.log(`📥 ${method} ${url} - User: ${userId} - IP: ${ip} - UA: ${userAgent.substring(0, 50)}...`);
        if (process.env.NODE_ENV === 'development') {
            this.logger.debug(`Request Details:`, {
                method,
                url,
                headers: this.sanitizeHeaders(headers),
                body: this.sanitizeBody(body),
                query,
                params,
                userId,
                ip,
                userAgent
            });
        }
        return next.handle().pipe((0, operators_1.tap)((data) => {
            const duration = Date.now() - startTime;
            const statusCode = response.statusCode;
            this.logger.log(`📤 ${method} ${url} - ${statusCode} - ${duration}ms - User: ${userId}`);
            if (process.env.NODE_ENV === 'development') {
                this.logger.debug(`Response Details:`, {
                    statusCode,
                    duration,
                    contentLength: response.get('Content-Length') || 'Unknown',
                    responseSize: data ? JSON.stringify(data).length : 0
                });
            }
            this.recordMetrics(request, response, duration, false);
        }), (0, operators_1.catchError)((error) => {
            const duration = Date.now() - startTime;
            const statusCode = error.status || 500;
            this.logger.error(`❌ ${method} ${url} - ${statusCode} - ${duration}ms - User: ${userId} - Error: ${error.message}`);
            this.logger.debug(`Error Details:`, {
                statusCode,
                duration,
                error: error.message,
                stack: error.stack,
                userId,
                ip,
                url
            });
            this.recordMetrics(request, response, duration, true);
            throw error;
        }));
    }
    getClientIp(request) {
        const forwarded = request.headers['x-forwarded-for'];
        const ip = forwarded ? forwarded.split(',')[0] : request.ip;
        return ip || 'Unknown';
    }
    sanitizeHeaders(headers) {
        const sanitized = { ...headers };
        const sensitiveHeaders = [
            'authorization',
            'cookie',
            'x-api-key',
            'x-auth-token'
        ];
        sensitiveHeaders.forEach(header => {
            if (sanitized[header]) {
                sanitized[header] = '[REDACTED]';
            }
        });
        return sanitized;
    }
    sanitizeBody(body) {
        if (!body)
            return body;
        const sanitized = { ...body };
        const sensitiveFields = [
            'password',
            'token',
            'secret',
            'key',
            'apiKey',
            'authorization'
        ];
        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                sanitized[field] = '[REDACTED]';
            }
        });
        return sanitized;
    }
    recordMetrics(request, response, duration, isError) {
        try {
            const performanceService = global.performanceService;
            if (performanceService && typeof performanceService.recordRequest === 'function') {
                performanceService.recordRequest(duration, isError);
            }
        }
        catch (error) {
        }
    }
};
exports.RequestLoggingInterceptor = RequestLoggingInterceptor;
exports.RequestLoggingInterceptor = RequestLoggingInterceptor = __decorate([
    (0, common_1.Injectable)()
], RequestLoggingInterceptor);
//# sourceMappingURL=request-logging.interceptor.js.map