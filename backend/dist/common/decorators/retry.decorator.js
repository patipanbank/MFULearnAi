"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExternalServiceRetry = exports.DatabaseRetry = exports.NetworkRetry = void 0;
exports.Retry = Retry;
const common_1 = require("@nestjs/common");
const DEFAULT_RETRY_OPTIONS = {
    maxAttempts: 3,
    delay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000,
    retryOn: (error) => {
        return (error.code === 'ECONNRESET' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ECONNREFUSED' ||
            error.code === 'ETIMEDOUT' ||
            error.name === 'TimeoutError' ||
            error.name === 'NetworkError' ||
            (error.status && error.status >= 500) ||
            (error.response && error.response.status >= 500));
    },
};
function Retry(options = {}) {
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        const logger = new common_1.Logger(`${target.constructor.name}.${propertyName}`);
        descriptor.value = async function (...args) {
            const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
            let lastError;
            for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
                try {
                    const result = await method.apply(this, args);
                    if (attempt > 1) {
                        logger.log(`✅ Method recovered after ${attempt} attempts`);
                    }
                    return result;
                }
                catch (error) {
                    lastError = error;
                    if (!opts.retryOn(error)) {
                        logger.debug(`❌ Error not retryable: ${error.message}`);
                        throw error;
                    }
                    if (attempt === opts.maxAttempts) {
                        logger.error(`❌ Method failed after ${attempt} attempts: ${error.message}`);
                        throw error;
                    }
                    const delay = Math.min(opts.delay * Math.pow(opts.backoffMultiplier, attempt - 1), opts.maxDelay);
                    logger.warn(`🔄 Retry attempt ${attempt}/${opts.maxAttempts} after ${delay}ms delay: ${error.message}`);
                    if (opts.onRetry) {
                        opts.onRetry(error, attempt);
                    }
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            throw lastError;
        };
        return descriptor;
    };
}
const NetworkRetry = () => Retry({
    maxAttempts: 3,
    delay: 1000,
    backoffMultiplier: 2,
    retryOn: (error) => {
        return (error.code === 'ECONNRESET' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ECONNREFUSED' ||
            error.code === 'ETIMEDOUT' ||
            error.name === 'NetworkError');
    },
});
exports.NetworkRetry = NetworkRetry;
const DatabaseRetry = () => Retry({
    maxAttempts: 2,
    delay: 500,
    backoffMultiplier: 2,
    retryOn: (error) => {
        return (error.name === 'MongoNetworkError' ||
            error.name === 'MongoTimeoutError' ||
            error.code === 'ECONNRESET' ||
            (error.message && error.message.includes('connection')));
    },
});
exports.DatabaseRetry = DatabaseRetry;
const ExternalServiceRetry = () => Retry({
    maxAttempts: 3,
    delay: 2000,
    backoffMultiplier: 1.5,
    maxDelay: 10000,
    retryOn: (error) => {
        return ((error.status && error.status >= 500) ||
            (error.response && error.response.status >= 500) ||
            error.code === 'ECONNRESET' ||
            error.code === 'ETIMEDOUT' ||
            error.name === 'TimeoutError');
    },
});
exports.ExternalServiceRetry = ExternalServiceRetry;
//# sourceMappingURL=retry.decorator.js.map