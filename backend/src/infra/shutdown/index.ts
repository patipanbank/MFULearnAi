/**
 * Graceful Shutdown Handler — Enterprise Process Lifecycle
 *
 * Ensures clean shutdown of all resources when the process receives
 * SIGTERM (Docker/K8s), SIGINT (Ctrl+C), or critical errors.
 *
 * Shutdown sequence:
 *  1. Stop accepting new HTTP connections
 *  2. Wait for in-flight requests to drain (configurable timeout)
 *  3. Close Socket.IO connections
 *  4. Disconnect MCP clients
 *  5. Close queue connections (BullMQ)
 *  6. Flush OpenTelemetry data
 *  7. Close Redis connection
 *  8. Close MongoDB connection
 *  9. Exit process
 */

import { Server as HttpServer } from 'http';
import { LoggerService } from '../../services/LoggerService';

// ── Configuration ───────────────────────────────────────────
const DRAIN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_DRAIN_TIMEOUT_MS || '15000'); // 15s
const FORCE_EXIT_MS = parseInt(process.env.SHUTDOWN_FORCE_EXIT_MS || '30000'); // 30s hard limit

type CleanupFn = () => Promise<void>;

interface ShutdownRegistration {
    name: string;
    fn: CleanupFn;
    priority: number; // Lower = runs first
}

// ── State ───────────────────────────────────────────────────
let _isShuttingDown = false;
const _registrations: ShutdownRegistration[] = [];

/**
 * Register a cleanup function to be called during shutdown.
 * Lower priority numbers execute first.
 */
export function registerShutdownHook(name: string, fn: CleanupFn, priority: number = 50): void {
    _registrations.push({ name, fn, priority });
}

/**
 * Check if the process is currently shutting down.
 * Middleware can use this to reject new requests.
 */
export function isShuttingDown(): boolean {
    return _isShuttingDown;
}

/**
 * Install the graceful shutdown handler on a running HTTP server.
 * Should be called once, right after `httpServer.listen()`.
 */
export function installGracefulShutdown(httpServer: HttpServer): void {
    // Prevent double-registration
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

    for (const signal of signals) {
        process.on(signal, () => {
            console.log(`\n[Shutdown] Received ${signal} — initiating graceful shutdown...`);
            shutdown(httpServer, signal);
        });
    }
}

/**
 * Middleware that rejects new requests during shutdown.
 */
export function shutdownGuard(req: any, res: any, next: any): void {
    if (_isShuttingDown) {
        res.setHeader('Connection', 'close');
        res.status(503).json({
            error: 'Service is shutting down',
            retryAfter: 10
        });
        return;
    }
    next();
}

// ── Core Shutdown Logic ─────────────────────────────────────

async function shutdown(httpServer: HttpServer, signal: string): Promise<void> {
    if (_isShuttingDown) return; // Prevent concurrent shutdown
    _isShuttingDown = true;

    const startTime = Date.now();
    console.log(`[Shutdown] Starting graceful shutdown (drain timeout: ${DRAIN_TIMEOUT_MS}ms)...`);

    // Hard exit safety net — if shutdown takes too long, force exit
    const forceExitTimer = setTimeout(() => {
        console.error(`[Shutdown] FORCE EXIT — shutdown exceeded ${FORCE_EXIT_MS}ms`);
        process.exit(1);
    }, FORCE_EXIT_MS);
    forceExitTimer.unref(); // Don't keep process alive just for this timer

    try {
        // 1. Stop accepting new connections (let in-flight requests drain)
        await new Promise<void>((resolve) => {
            httpServer.close(() => {
                console.log('[Shutdown] HTTP server closed — no new connections');
                resolve();
            });

            // If server doesn't close within drain timeout, continue anyway
            setTimeout(() => {
                console.warn('[Shutdown] HTTP drain timeout — forcing close');
                resolve();
            }, DRAIN_TIMEOUT_MS);
        });

        // 2. Run registered cleanup hooks in priority order
        const sorted = _registrations.sort((a, b) => a.priority - b.priority);

        for (const reg of sorted) {
            try {
                console.log(`[Shutdown] Running: ${reg.name}...`);
                await Promise.race([
                    reg.fn(),
                    new Promise<void>((_, reject) =>
                        setTimeout(() => reject(new Error('timeout')), 5_000)
                    )
                ]);
                console.log(`[Shutdown] ✓ ${reg.name}`);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                console.error(`[Shutdown] ✗ ${reg.name}: ${message}`);
            }
        }

        const elapsed = Date.now() - startTime;
        console.log(`[Shutdown] Graceful shutdown complete in ${elapsed}ms`);

        // Log the shutdown (fire-and-forget)
        LoggerService.info('graceful_shutdown_complete', {
            signal,
            elapsedMs: elapsed,
            hooks: sorted.map(r => r.name)
        }).catch(() => { });

    } catch (err) {
        console.error('[Shutdown] Error during shutdown:', err);
    } finally {
        clearTimeout(forceExitTimer);
        process.exit(0);
    }
}
