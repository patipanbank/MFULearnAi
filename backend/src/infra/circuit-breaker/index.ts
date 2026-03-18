import { LoggerService } from '../../services/LoggerService';

/**
 * Circuit Breaker — Enterprise-grade fault tolerance for tool execution.
 *
 * States:
 *   CLOSED  → Normal operation. Failures counted.
 *   OPEN    → Tool is disabled. All calls short-circuit with an error.
 *   HALF_OPEN → Probe mode. One call allowed through to test recovery.
 *
 * Transitions:
 *   CLOSED → OPEN: When failure count >= threshold within the window.
 *   OPEN → HALF_OPEN: After cooldown period expires.
 *   HALF_OPEN → CLOSED: If probe call succeeds.
 *   HALF_OPEN → OPEN: If probe call fails (resets cooldown).
 *
 * Thread-safe for single-process Node.js (no lock needed).
 */

export enum CircuitState {
    CLOSED = 'CLOSED',
    OPEN = 'OPEN',
    HALF_OPEN = 'HALF_OPEN'
}

interface CircuitConfig {
    /** Failures needed to trip the breaker */
    failureThreshold: number;
    /** Time window for counting failures (ms) */
    failureWindowMs: number;
    /** How long to stay open before probing (ms) */
    cooldownMs: number;
    /** Consecutive successes in HALF_OPEN to fully close */
    halfOpenSuccessThreshold: number;
}

interface CircuitEntry {
    state: CircuitState;
    failures: { timestamp: number }[];
    lastStateChange: number;
    halfOpenSuccesses: number;
    totalTrips: number;
    lastFailureReason?: string;
}

const DEFAULT_CONFIG: CircuitConfig = {
    failureThreshold: parseInt(process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD || '5', 10),
    failureWindowMs: parseInt(process.env.CIRCUIT_BREAKER_WINDOW_MS || '60000', 10), // 1 min
    cooldownMs: parseInt(process.env.CIRCUIT_BREAKER_COOLDOWN_MS || '30000', 10), // 30s
    halfOpenSuccessThreshold: parseInt(process.env.CIRCUIT_BREAKER_HALF_OPEN_SUCCESS || '2', 10),
};

export class CircuitBreaker {
    private static circuits: Map<string, CircuitEntry> = new Map();
    private static config: CircuitConfig = { ...DEFAULT_CONFIG };
    /** Per-tool config overrides */
    private static toolOverrides: Map<string, Partial<CircuitConfig>> = new Map();

    /**
     * Override config for a specific tool (e.g., external MCP tools get tighter thresholds).
     */
    static setToolConfig(toolName: string, override: Partial<CircuitConfig>): void {
        this.toolOverrides.set(toolName, override);
    }

    /**
     * Get the effective config for a tool.
     */
    private static getConfig(toolName: string): CircuitConfig {
        const override = this.toolOverrides.get(toolName);
        return override ? { ...this.config, ...override } : this.config;
    }

    /**
     * Check if a tool is allowed to execute.
     * Returns { allowed: true } or { allowed: false, reason: string }.
     */
    static canExecute(toolName: string): { allowed: boolean; state: CircuitState; reason?: string } {
        const entry = this.getOrCreate(toolName);
        const config = this.getConfig(toolName);
        const now = Date.now();

        switch (entry.state) {
            case CircuitState.CLOSED:
                return { allowed: true, state: CircuitState.CLOSED };

            case CircuitState.OPEN: {
                const elapsed = now - entry.lastStateChange;
                if (elapsed >= config.cooldownMs) {
                    // Transition to HALF_OPEN
                    entry.state = CircuitState.HALF_OPEN;
                    entry.lastStateChange = now;
                    entry.halfOpenSuccesses = 0;
                    LoggerService.info('circuit_breaker_half_open', {
                        tool: toolName,
                        cooldownElapsed: elapsed
                    });
                    return { allowed: true, state: CircuitState.HALF_OPEN };
                }
                return {
                    allowed: false,
                    state: CircuitState.OPEN,
                    reason: `Circuit OPEN for "${toolName}" — ${Math.ceil((config.cooldownMs - elapsed) / 1000)}s until probe. Last failure: ${entry.lastFailureReason || 'unknown'}`
                };
            }

            case CircuitState.HALF_OPEN:
                // Allow probe call through
                return { allowed: true, state: CircuitState.HALF_OPEN };

            default:
                return { allowed: true, state: CircuitState.CLOSED };
        }
    }

    /**
     * Record a successful tool execution.
     */
    static recordSuccess(toolName: string): void {
        const entry = this.getOrCreate(toolName);
        const config = this.getConfig(toolName);

        if (entry.state === CircuitState.HALF_OPEN) {
            entry.halfOpenSuccesses++;
            if (entry.halfOpenSuccesses >= config.halfOpenSuccessThreshold) {
                // Fully close the circuit
                entry.state = CircuitState.CLOSED;
                entry.failures = [];
                entry.halfOpenSuccesses = 0;
                entry.lastStateChange = Date.now();
                LoggerService.info('circuit_breaker_closed', {
                    tool: toolName,
                    reason: 'half_open_probe_success',
                    totalTrips: entry.totalTrips
                });
            }
        } else if (entry.state === CircuitState.CLOSED) {
            // Prune old failures outside the window
            const now = Date.now();
            entry.failures = entry.failures.filter(f => now - f.timestamp < config.failureWindowMs);
        }
    }

    /**
     * Record a failed tool execution.
     */
    static recordFailure(toolName: string, reason?: string): void {
        const entry = this.getOrCreate(toolName);
        const config = this.getConfig(toolName);
        const now = Date.now();

        entry.lastFailureReason = reason;

        if (entry.state === CircuitState.HALF_OPEN) {
            // Probe failed — go back to OPEN
            entry.state = CircuitState.OPEN;
            entry.lastStateChange = now;
            entry.halfOpenSuccesses = 0;
            LoggerService.warn('circuit_breaker_reopened', {
                tool: toolName,
                reason: 'half_open_probe_failed',
                failureReason: reason
            });
            return;
        }

        // CLOSED state — count failures
        entry.failures.push({ timestamp: now });

        // Prune failures outside window
        entry.failures = entry.failures.filter(f => now - f.timestamp < config.failureWindowMs);

        if (entry.failures.length >= config.failureThreshold) {
            entry.state = CircuitState.OPEN;
            entry.lastStateChange = now;
            entry.totalTrips++;
            LoggerService.warn('circuit_breaker_tripped', {
                tool: toolName,
                failures: entry.failures.length,
                threshold: config.failureThreshold,
                windowMs: config.failureWindowMs,
                cooldownMs: config.cooldownMs,
                totalTrips: entry.totalTrips,
                lastFailure: reason
            });
        }
    }

    /**
     * Get status of all circuits (for admin/monitoring API).
     */
    static getAllStatus(): Array<{
        toolName: string;
        state: CircuitState;
        failureCount: number;
        totalTrips: number;
        lastFailureReason?: string;
        lastStateChange: number;
    }> {
        const result: Array<{
            toolName: string;
            state: CircuitState;
            failureCount: number;
            totalTrips: number;
            lastFailureReason?: string;
            lastStateChange: number;
        }> = [];
        for (const [toolName, entry] of this.circuits) {
            result.push({
                toolName,
                state: entry.state,
                failureCount: entry.failures.length,
                totalTrips: entry.totalTrips,
                lastFailureReason: entry.lastFailureReason,
                lastStateChange: entry.lastStateChange
            });
        }
        return result;
    }

    /**
     * Manually reset a circuit (admin action).
     */
    static reset(toolName: string): void {
        this.circuits.delete(toolName);
        LoggerService.audit('circuit_breaker_manual_reset', { tool: toolName });
    }

    /**
     * Reset all circuits.
     */
    static resetAll(): void {
        this.circuits.clear();
        LoggerService.audit('circuit_breaker_reset_all', {});
    }

    private static getOrCreate(toolName: string): CircuitEntry {
        let entry = this.circuits.get(toolName);
        if (!entry) {
            entry = {
                state: CircuitState.CLOSED,
                failures: [],
                lastStateChange: Date.now(),
                halfOpenSuccesses: 0,
                totalTrips: 0
            };
            this.circuits.set(toolName, entry);
        }
        return entry;
    }
}
