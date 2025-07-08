"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreakerManager = exports.CircuitBreaker = exports.CircuitBreakerState = void 0;
exports.CircuitBreak = CircuitBreak;
const common_1 = require("@nestjs/common");
var CircuitBreakerState;
(function (CircuitBreakerState) {
    CircuitBreakerState["CLOSED"] = "CLOSED";
    CircuitBreakerState["OPEN"] = "OPEN";
    CircuitBreakerState["HALF_OPEN"] = "HALF_OPEN";
})(CircuitBreakerState || (exports.CircuitBreakerState = CircuitBreakerState = {}));
class CircuitBreaker {
    constructor(name, options = {}) {
        this.name = name;
        this.logger = new common_1.Logger(CircuitBreaker.name);
        this.state = CircuitBreakerState.CLOSED;
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            consecutiveFailures: 0,
        };
        this.nextAttempt = 0;
        this.options = {
            failureThreshold: 5,
            recoveryTimeout: 60000,
            monitoringPeriod: 10000,
            expectedErrors: ['TimeoutError', 'NetworkError', 'ECONNRESET', 'ENOTFOUND'],
            onStateChange: () => { },
            onFailure: () => { },
            onSuccess: () => { },
            ...options,
        };
        this.logger.log(`🔧 Circuit breaker '${this.name}' initialized`);
    }
    async execute(operation) {
        this.stats.totalRequests++;
        if (this.state === CircuitBreakerState.OPEN) {
            if (this.shouldAttemptReset()) {
                this.setState(CircuitBreakerState.HALF_OPEN);
            }
            else {
                throw new Error(`Circuit breaker '${this.name}' is OPEN. Next attempt allowed at ${new Date(this.nextAttempt).toISOString()}`);
            }
        }
        try {
            const result = await operation();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onError(error);
            throw error;
        }
    }
    onSuccess() {
        this.stats.successfulRequests++;
        this.stats.consecutiveFailures = 0;
        if (this.state === CircuitBreakerState.HALF_OPEN) {
            this.setState(CircuitBreakerState.CLOSED);
            this.logger.log(`✅ Circuit breaker '${this.name}' recovered and closed`);
        }
        this.options.onSuccess();
    }
    onError(error) {
        this.stats.failedRequests++;
        this.stats.lastFailureTime = Date.now();
        if (this.isExpectedError(error)) {
            this.stats.consecutiveFailures++;
            if (this.state === CircuitBreakerState.HALF_OPEN) {
                this.setState(CircuitBreakerState.OPEN);
                this.scheduleNextAttempt();
            }
            else if (this.state === CircuitBreakerState.CLOSED &&
                this.stats.consecutiveFailures >= this.options.failureThreshold) {
                this.setState(CircuitBreakerState.OPEN);
                this.scheduleNextAttempt();
            }
        }
        this.options.onFailure(error);
    }
    isExpectedError(error) {
        var _a;
        if (!error)
            return false;
        const errorIdentifiers = [
            error.name,
            error.code,
            (_a = error.constructor) === null || _a === void 0 ? void 0 : _a.name,
        ].filter(Boolean);
        return this.options.expectedErrors.some(expectedError => errorIdentifiers.includes(expectedError) ||
            (error.message && error.message.includes(expectedError)));
    }
    shouldAttemptReset() {
        return Date.now() >= this.nextAttempt;
    }
    scheduleNextAttempt() {
        this.nextAttempt = Date.now() + this.options.recoveryTimeout;
    }
    setState(newState) {
        const oldState = this.state;
        if (oldState !== newState) {
            this.state = newState;
            this.logger.log(`🔄 Circuit breaker '${this.name}' state changed: ${oldState} -> ${newState}`);
            this.options.onStateChange(oldState, newState);
        }
    }
    getState() {
        return this.state;
    }
    getStats() {
        const failureRate = this.stats.totalRequests > 0
            ? this.stats.failedRequests / this.stats.totalRequests
            : 0;
        const uptime = this.state === CircuitBreakerState.CLOSED ? 100 : 0;
        const isHealthy = this.state === CircuitBreakerState.CLOSED && failureRate < 0.1;
        return {
            ...this.stats,
            failureRate: Math.round(failureRate * 100) / 100,
            uptime,
            isHealthy,
        };
    }
    reset() {
        this.state = CircuitBreakerState.CLOSED;
        this.stats = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            consecutiveFailures: 0,
        };
        this.nextAttempt = 0;
        this.logger.log(`🔄 Circuit breaker '${this.name}' manually reset`);
    }
    forceOpen() {
        this.setState(CircuitBreakerState.OPEN);
        this.scheduleNextAttempt();
        this.logger.warn(`🚨 Circuit breaker '${this.name}' manually opened`);
    }
    forceClose() {
        this.setState(CircuitBreakerState.CLOSED);
        this.stats.consecutiveFailures = 0;
        this.nextAttempt = 0;
        this.logger.log(`🔧 Circuit breaker '${this.name}' manually closed`);
    }
}
exports.CircuitBreaker = CircuitBreaker;
function CircuitBreak(options) {
    const circuitBreaker = new CircuitBreaker(options.name, options);
    return function (target, propertyName, descriptor) {
        const method = descriptor.value;
        descriptor.value = async function (...args) {
            return circuitBreaker.execute(() => method.apply(this, args));
        };
        if (!target.constructor.circuitBreakers) {
            target.constructor.circuitBreakers = new Map();
        }
        target.constructor.circuitBreakers.set(propertyName, circuitBreaker);
        return descriptor;
    };
}
class CircuitBreakerManager {
    static register(name, breaker) {
        this.breakers.set(name, breaker);
        this.logger.log(`📋 Registered circuit breaker: ${name}`);
    }
    static unregister(name) {
        this.breakers.delete(name);
        this.logger.log(`📋 Unregistered circuit breaker: ${name}`);
    }
    static get(name) {
        return this.breakers.get(name);
    }
    static getAll() {
        return new Map(this.breakers);
    }
    static getHealthStatus() {
        const status = {};
        for (const [name, breaker] of this.breakers) {
            status[name] = {
                state: breaker.getState(),
                stats: breaker.getStats(),
            };
        }
        return status;
    }
    static resetAll() {
        for (const [name, breaker] of this.breakers) {
            breaker.reset();
        }
        this.logger.log(`🔄 Reset all circuit breakers`);
    }
}
exports.CircuitBreakerManager = CircuitBreakerManager;
CircuitBreakerManager.breakers = new Map();
CircuitBreakerManager.logger = new common_1.Logger(CircuitBreakerManager.name);
//# sourceMappingURL=circuit-breaker.js.map