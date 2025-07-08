"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TimeoutInterceptor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamicTimeout = exports.StreamingTimeout = exports.LongTimeout = exports.MediumTimeout = exports.ShortTimeout = exports.TimeoutInterceptor = void 0;
exports.Timeout = Timeout;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
let TimeoutInterceptor = TimeoutInterceptor_1 = class TimeoutInterceptor {
    constructor(options = {}) {
        this.options = options;
        this.logger = new common_1.Logger(TimeoutInterceptor_1.name);
        this.defaultTimeout = 30000;
    }
    intercept(context, next) {
        var _a;
        const request = context.switchToHttp().getRequest();
        const path = request.url;
        if ((_a = this.options.excludePaths) === null || _a === void 0 ? void 0 : _a.some(excludePath => path.includes(excludePath))) {
            return next.handle();
        }
        const timeoutValue = this.getTimeoutValue(context);
        request.timeoutStart = Date.now();
        request.timeoutValue = timeoutValue;
        return next.handle().pipe((0, operators_1.timeout)(timeoutValue), (0, operators_1.catchError)((error) => {
            if (error instanceof rxjs_1.TimeoutError) {
                const duration = Date.now() - request.timeoutStart;
                const timeoutMessage = this.options.message ||
                    `Request timeout after ${timeoutValue}ms (actual: ${duration}ms)`;
                this.logger.warn(`⏰ Request timeout: ${request.method} ${path} - ${timeoutMessage}`, {
                    method: request.method,
                    path,
                    timeout: timeoutValue,
                    duration,
                    userAgent: request.headers['user-agent'],
                    ip: request.ip,
                });
                return (0, rxjs_1.throwError)(() => new common_1.RequestTimeoutException(timeoutMessage));
            }
            return (0, rxjs_1.throwError)(() => error);
        }));
    }
    getTimeoutValue(context) {
        if (this.options.dynamicTimeout) {
            return this.options.dynamicTimeout(context);
        }
        return this.options.timeout || this.defaultTimeout;
    }
};
exports.TimeoutInterceptor = TimeoutInterceptor;
exports.TimeoutInterceptor = TimeoutInterceptor = TimeoutInterceptor_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [Object])
], TimeoutInterceptor);
const ShortTimeout = () => new TimeoutInterceptor({
    timeout: 5000,
    message: 'Request timeout - operation took too long'
});
exports.ShortTimeout = ShortTimeout;
const MediumTimeout = () => new TimeoutInterceptor({
    timeout: 15000,
    message: 'Request timeout - please try again'
});
exports.MediumTimeout = MediumTimeout;
const LongTimeout = () => new TimeoutInterceptor({
    timeout: 60000,
    message: 'Request timeout - operation timed out'
});
exports.LongTimeout = LongTimeout;
const StreamingTimeout = () => new TimeoutInterceptor({
    timeout: 300000,
    message: 'Streaming operation timeout',
    excludePaths: ['/health', '/metrics'],
});
exports.StreamingTimeout = StreamingTimeout;
const DynamicTimeout = () => new TimeoutInterceptor({
    dynamicTimeout: (context) => {
        const request = context.switchToHttp().getRequest();
        const path = request.url;
        if (path.includes('/agents/execute-streaming')) {
            return 300000;
        }
        else if (path.includes('/upload')) {
            return 120000;
        }
        else if (path.includes('/auth')) {
            return 10000;
        }
        else if (path.includes('/health')) {
            return 5000;
        }
        return 30000;
    },
});
exports.DynamicTimeout = DynamicTimeout;
function Timeout(timeoutMs, message) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        const logger = new common_1.Logger(`${target.constructor.name}.${propertyName}`);
        descriptor.value = async function (...args) {
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(new common_1.RequestTimeoutException(message || `Method '${propertyName}' timeout after ${timeoutMs}ms`));
                }, timeoutMs);
            });
            const operationPromise = method.apply(this, args);
            try {
                const result = await Promise.race([operationPromise, timeoutPromise]);
                return result;
            }
            catch (error) {
                if (error instanceof common_1.RequestTimeoutException) {
                    logger.warn(`⏰ Method timeout: ${propertyName} after ${timeoutMs}ms`);
                }
                throw error;
            }
        };
        return descriptor;
    };
}
//# sourceMappingURL=timeout.interceptor.js.map