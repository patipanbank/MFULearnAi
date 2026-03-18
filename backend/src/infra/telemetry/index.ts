/**
 * OpenTelemetry Instrumentation — Enterprise Observability
 *
 * Provides distributed tracing and metrics collection.
 * Must be loaded BEFORE any other imports in the application entry point.
 *
 * Features:
 *  - Automatic HTTP/Express instrumentation
 *  - Custom span creation for agent workflows, tool calls, LLM requests
 *  - Metric counters for tokens, tool usage, errors
 *  - Trace context propagation (W3C TraceContext)
 *  - Graceful shutdown support
 *
 * Configuration via environment variables:
 *  - OTEL_ENABLED=true              — Enable telemetry (default: false)
 *  - OTEL_SERVICE_NAME              — Service name (default: mful-backend)
 *  - OTEL_EXPORTER_OTLP_ENDPOINT   — OTLP collector endpoint
 *  - OTEL_LOG_LEVEL                 — SDK log level (default: warn)
 */

import { ContextService } from '../../services/ContextService';

// ── Types ────────────────────────────────────────────────────
export interface SpanOptions {
    name: string;
    attributes?: Record<string, string | number | boolean>;
    parentTraceId?: string;
}

export interface TelemetryMetrics {
    tokenCounter: (model: string, input: number, output: number) => void;
    toolCallCounter: (toolName: string, success: boolean, durationMs: number) => void;
    workflowCounter: (phase: string, success: boolean, durationMs: number) => void;
    errorCounter: (component: string, errorType: string) => void;
}

// ── Stub Implementation (No-op when OTEL_ENABLED=false) ────
const NOOP_SPAN = {
    end: () => { },
    setAttribute: (_k: string, _v: unknown) => { },
    setStatus: (_s: { code: number; message?: string }) => { },
    recordException: (_e: Error) => { },
    addEvent: (_name: string, _attrs?: Record<string, unknown>) => { },
};

const NOOP_METRICS: TelemetryMetrics = {
    tokenCounter: () => { },
    toolCallCounter: () => { },
    workflowCounter: () => { },
    errorCounter: () => { },
};

// ── State ────────────────────────────────────────────────────
let _initialized = false;
let _sdk: any = null;
let _tracer: any = null;
let _meter: any = null;
let _metrics: TelemetryMetrics = NOOP_METRICS;

// ── Public API ───────────────────────────────────────────────

/**
 * Initialize OpenTelemetry SDK. Call once at startup BEFORE other imports.
 * Safe to call even when OTEL_ENABLED=false (becomes no-op).
 */
export async function initTelemetry(): Promise<void> {
    const enabled = process.env.OTEL_ENABLED === 'true';
    if (!enabled || _initialized) return;

    try {
        // Dynamic imports — only loaded when telemetry is enabled.
        // These packages are optional dependencies — install them to enable tracing:
        //   npm install @opentelemetry/sdk-node @opentelemetry/api @opentelemetry/resources \
        //     @opentelemetry/semantic-conventions @opentelemetry/exporter-trace-otlp-http \
        //     @opentelemetry/exporter-metrics-otlp-http @opentelemetry/sdk-metrics \
        //     @opentelemetry/auto-instrumentations-node

        // @ts-ignore — Optional dependencies, dynamically imported
        const { NodeSDK } = await import('@opentelemetry/sdk-node');
        // @ts-ignore
        const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
        // @ts-ignore
        const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http');
        // @ts-ignore
        const { PeriodicExportingMetricReader } = await import('@opentelemetry/sdk-metrics');
        // @ts-ignore
        const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
        // @ts-ignore
        const { Resource } = await import('@opentelemetry/resources');
        // @ts-ignore
        const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import('@opentelemetry/semantic-conventions');
        // @ts-ignore
        const api = await import('@opentelemetry/api');

        const serviceName = process.env.OTEL_SERVICE_NAME || 'mful-backend';
        const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

        const resource = new Resource({
            [ATTR_SERVICE_NAME]: serviceName,
            [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
            'deployment.environment': process.env.ENV_TYPE || 'TEST',
        });

        const traceExporter = new OTLPTraceExporter({ url: `${endpoint}/v1/traces` });
        const metricExporter = new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` });

        const metricReader = new PeriodicExportingMetricReader({
            exporter: metricExporter,
            exportIntervalMillis: 30_000, // 30s
        });

        _sdk = new NodeSDK({
            resource,
            traceExporter,
            metricReader,
            instrumentations: [
                getNodeAutoInstrumentations({
                    '@opentelemetry/instrumentation-http': { enabled: true },
                    '@opentelemetry/instrumentation-express': { enabled: true },
                    '@opentelemetry/instrumentation-mongoose': { enabled: true },
                    '@opentelemetry/instrumentation-ioredis': { enabled: true },
                    // Disable fs/dns to reduce noise
                    '@opentelemetry/instrumentation-fs': { enabled: false },
                    '@opentelemetry/instrumentation-dns': { enabled: false },
                }),
            ],
        });

        _sdk.start();
        _initialized = true;

        _tracer = api.trace.getTracer(serviceName);
        _meter = api.metrics.getMeter(serviceName);

        // ── Custom Metrics ──
        const tokenUsageCounter = _meter.createCounter('agent.tokens.total', {
            description: 'Total tokens consumed by agent workflows',
        });

        const toolCallHistogram = _meter.createHistogram('agent.tool.duration_ms', {
            description: 'Tool call duration in milliseconds',
        });

        const toolCallSuccessCounter = _meter.createCounter('agent.tool.calls', {
            description: 'Total tool calls',
        });

        const workflowHistogram = _meter.createHistogram('agent.workflow.duration_ms', {
            description: 'Agent workflow phase duration',
        });

        const errorCounter = _meter.createCounter('agent.errors.total', {
            description: 'Total errors by component',
        });

        _metrics = {
            tokenCounter: (model, input, output) => {
                tokenUsageCounter.add(input, { model, type: 'input' });
                tokenUsageCounter.add(output, { model, type: 'output' });
            },
            toolCallCounter: (toolName, success, durationMs) => {
                toolCallSuccessCounter.add(1, { tool: toolName, success: String(success) });
                toolCallHistogram.record(durationMs, { tool: toolName, success: String(success) });
            },
            workflowCounter: (phase, success, durationMs) => {
                workflowHistogram.record(durationMs, { phase, success: String(success) });
            },
            errorCounter: (component, errorType) => {
                errorCounter.add(1, { component, errorType });
            },
        };

        console.log(`[Telemetry] OpenTelemetry initialized — exporting to ${endpoint}`);
    } catch (err) {
        console.warn('[Telemetry] Failed to initialize OpenTelemetry:', err);
        // Silently degrade — app continues without telemetry
    }
}

/**
 * Create a child span for tracing a unit of work.
 * Returns a no-op span when telemetry is disabled.
 */
export function startSpan(options: SpanOptions): typeof NOOP_SPAN {
    if (!_initialized || !_tracer) return NOOP_SPAN;

    try {
        const api = require('@opentelemetry/api');
        const span = _tracer.startSpan(options.name, {
            attributes: {
                ...options.attributes,
                'correlation.id': ContextService.getCorrelationId(),
            },
        });
        return span;
    } catch {
        return NOOP_SPAN;
    }
}

/**
 * Wrap an async function in a traced span.
 * Automatically records duration, errors, and sets status.
 */
export async function traceAsync<T>(
    name: string,
    fn: () => Promise<T>,
    attributes?: Record<string, string | number | boolean>
): Promise<T> {
    if (!_initialized) return fn();

    const span = startSpan({ name, attributes });
    try {
        const result = await fn();
        span.setStatus({ code: 1 }); // OK
        return result;
    } catch (err) {
        span.setStatus({ code: 2, message: (err as Error).message }); // ERROR
        span.recordException(err as Error);
        throw err;
    } finally {
        span.end();
    }
}

/**
 * Get metrics instance for recording custom counters/histograms.
 */
export function getMetrics(): TelemetryMetrics {
    return _metrics;
}

/**
 * Check if telemetry is active.
 */
export function isTelemetryEnabled(): boolean {
    return _initialized;
}

/**
 * Graceful shutdown of the OpenTelemetry SDK.
 * Flushes pending traces/metrics before process exit.
 */
export async function shutdownTelemetry(): Promise<void> {
    if (!_sdk) return;
    try {
        await _sdk.shutdown();
        console.log('[Telemetry] OpenTelemetry shut down gracefully');
    } catch (err) {
        console.error('[Telemetry] Error shutting down OpenTelemetry:', err);
    }
}
