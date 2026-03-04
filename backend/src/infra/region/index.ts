/**
 * Multi-Region Failover Configuration
 *
 * Provides region-aware configuration and failover abstractions for:
 *  - AWS Bedrock model endpoints (cross-region fallback)
 *  - Redis (primary + replica)
 *  - MongoDB (replica set with read preferences)
 *  - S3/MinIO (multi-region buckets)
 *
 * Configuration via environment variables:
 *  - PRIMARY_REGION           — Primary AWS region (default: ap-southeast-1)
 *  - FAILOVER_REGIONS         — Comma-separated failover regions
 *  - REGION_HEALTH_CHECK_MS   — Health check interval (default: 30000)
 *  - ENABLE_CROSS_REGION      — Enable cross-region failover (default: false)
 *
 * Architecture:
 *  - Active-Passive model with automatic promotion
 *  - Health checks via lightweight pings
 *  - Circuit breaker per region (reuses ModelRouter pattern)
 */

import { LoggerService } from '../../services/LoggerService';

// ── Types ────────────────────────────────────────────────────

export interface RegionConfig {
    id: string;
    name: string;
    bedrockEndpoint?: string;
    redisUrl?: string;
    mongoUri?: string;
    s3Endpoint?: string;
    s3Bucket?: string;
    priority: number;        // Lower = preferred
    isHealthy: boolean;
    lastHealthCheck: number;
    consecutiveFailures: number;
}

export interface FailoverState {
    activeRegion: string;
    regions: RegionConfig[];
    lastFailoverAt: number | null;
    failoverCount: number;
}

// ── Configuration ────────────────────────────────────────────

const PRIMARY_REGION = process.env.PRIMARY_REGION || 'ap-southeast-1';
const FAILOVER_REGIONS = (process.env.FAILOVER_REGIONS || '').split(',').filter(Boolean);
const HEALTH_CHECK_INTERVAL_MS = parseInt(process.env.REGION_HEALTH_CHECK_MS || '30000');
const ENABLE_CROSS_REGION = process.env.ENABLE_CROSS_REGION === 'true';
const MAX_CONSECUTIVE_FAILURES = 3;
const RECOVERY_CHECK_INTERVAL_MS = 60_000; // 1 minute

// ── State ────────────────────────────────────────────────────

const _state: FailoverState = {
    activeRegion: PRIMARY_REGION,
    regions: [],
    lastFailoverAt: null,
    failoverCount: 0,
};

// ── Initialization ──────────────────────────────────────────

/**
 * Initialize multi-region configuration.
 * Builds the region list from environment variables.
 */
export function initRegionConfig(): FailoverState {
    // Primary region
    _state.regions = [{
        id: PRIMARY_REGION,
        name: `Primary (${PRIMARY_REGION})`,
        bedrockEndpoint: process.env.BEDROCK_ENDPOINT || undefined,
        redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
        mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mfulearnai',
        s3Endpoint: process.env.S3_ENDPOINT || process.env.MINIO_ENDPOINT || undefined,
        s3Bucket: process.env.S3_BUCKET || process.env.MINIO_BUCKET || undefined,
        priority: 0,
        isHealthy: true,
        lastHealthCheck: Date.now(),
        consecutiveFailures: 0,
    }];

    // Failover regions from env
    FAILOVER_REGIONS.forEach((region, idx) => {
        const prefix = `REGION_${region.replace(/-/g, '_').toUpperCase()}_`;
        _state.regions.push({
            id: region,
            name: `Failover ${idx + 1} (${region})`,
            bedrockEndpoint: process.env[`${prefix}BEDROCK_ENDPOINT`] || undefined,
            redisUrl: process.env[`${prefix}REDIS_URL`] || undefined,
            mongoUri: process.env[`${prefix}MONGODB_URI`] || undefined,
            s3Endpoint: process.env[`${prefix}S3_ENDPOINT`] || undefined,
            s3Bucket: process.env[`${prefix}S3_BUCKET`] || undefined,
            priority: idx + 1,
            isHealthy: true,
            lastHealthCheck: Date.now(),
            consecutiveFailures: 0,
        });
    });

    _state.activeRegion = PRIMARY_REGION;

    if (ENABLE_CROSS_REGION && FAILOVER_REGIONS.length > 0) {
        _startHealthChecks();
        LoggerService.info('multi_region_init', {
            primary: PRIMARY_REGION,
            failovers: FAILOVER_REGIONS,
            healthCheckMs: HEALTH_CHECK_INTERVAL_MS
        });
    } else {
        LoggerService.info('multi_region_disabled', {
            primary: PRIMARY_REGION,
            reason: ENABLE_CROSS_REGION ? 'no_failover_regions' : 'not_enabled'
        });
    }

    return _state;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Get the currently active region configuration.
 */
export function getActiveRegion(): RegionConfig {
    const active = _state.regions.find(r => r.id === _state.activeRegion);
    return active || _state.regions[0];
}

/**
 * Get all region configurations with health status.
 */
export function getAllRegions(): RegionConfig[] {
    return [..._state.regions];
}

/**
 * Get the failover state summary for monitoring.
 */
export function getFailoverState(): FailoverState {
    return { ..._state, regions: [..._state.regions] };
}

/**
 * Report a failure in the active region.
 * Triggers failover if consecutive failures exceed threshold.
 */
export function reportRegionFailure(regionId: string, error: string): void {
    const region = _state.regions.find(r => r.id === regionId);
    if (!region) return;

    region.consecutiveFailures++;
    region.lastHealthCheck = Date.now();

    LoggerService.warn('region_failure_reported', {
        region: regionId,
        consecutiveFailures: region.consecutiveFailures,
        threshold: MAX_CONSECUTIVE_FAILURES,
        error
    });

    if (region.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && region.id === _state.activeRegion) {
        _performFailover(regionId);
    }
}

/**
 * Report a successful operation in a region, resetting failure count.
 */
export function reportRegionSuccess(regionId: string): void {
    const region = _state.regions.find(r => r.id === regionId);
    if (!region) return;

    region.consecutiveFailures = 0;
    region.isHealthy = true;
    region.lastHealthCheck = Date.now();
}

/**
 * Manually trigger failover to a specific region or next healthy region.
 */
export function manualFailover(targetRegionId?: string): { success: boolean; newActive: string } {
    if (targetRegionId) {
        const target = _state.regions.find(r => r.id === targetRegionId && r.isHealthy);
        if (target) {
            _state.activeRegion = target.id;
            _state.lastFailoverAt = Date.now();
            _state.failoverCount++;
            LoggerService.info('manual_failover', { from: _state.activeRegion, to: target.id });
            return { success: true, newActive: target.id };
        }
        return { success: false, newActive: _state.activeRegion };
    }

    return _performFailover(_state.activeRegion);
}

// ── Internal ────────────────────────────────────────────────

function _performFailover(failedRegionId: string): { success: boolean; newActive: string } {
    const failed = _state.regions.find(r => r.id === failedRegionId);
    if (failed) {
        failed.isHealthy = false;
    }

    // Find next healthy region by priority
    const candidates = _state.regions
        .filter(r => r.isHealthy && r.id !== failedRegionId)
        .sort((a, b) => a.priority - b.priority);

    if (candidates.length === 0) {
        LoggerService.error('failover_no_healthy_region', {
            failedRegion: failedRegionId,
            allRegions: _state.regions.map(r => ({ id: r.id, healthy: r.isHealthy }))
        });
        return { success: false, newActive: _state.activeRegion };
    }

    const newActive = candidates[0];
    const previousActive = _state.activeRegion;

    _state.activeRegion = newActive.id;
    _state.lastFailoverAt = Date.now();
    _state.failoverCount++;

    LoggerService.warn('region_failover', {
        from: previousActive,
        to: newActive.id,
        reason: `${failedRegionId} marked unhealthy`,
        totalFailovers: _state.failoverCount
    });

    return { success: true, newActive: newActive.id };
}

function _startHealthChecks(): void {
    // Periodic health check for non-active regions (recovery detection)
    setInterval(async () => {
        for (const region of _state.regions) {
            if (region.isHealthy) continue;

            try {
                // Lightweight check — attempt Redis ping on the region's Redis
                if (region.redisUrl) {
                    const Redis = require('ioredis');
                    const testRedis = new Redis(region.redisUrl, {
                        connectTimeout: 3000,
                        maxRetriesPerRequest: 0,
                        lazyConnect: true,
                    });

                    await testRedis.connect();
                    await testRedis.ping();
                    testRedis.disconnect();

                    // Region recovered
                    region.isHealthy = true;
                    region.consecutiveFailures = 0;
                    region.lastHealthCheck = Date.now();

                    LoggerService.info('region_recovered', { region: region.id });

                    // If the recovered region has higher priority, fail back
                    const activeRegion = _state.regions.find(r => r.id === _state.activeRegion);
                    if (activeRegion && region.priority < activeRegion.priority) {
                        _state.activeRegion = region.id;
                        LoggerService.info('region_failback', {
                            from: activeRegion.id,
                            to: region.id,
                            reason: 'higher_priority_recovered'
                        });
                    }
                }
            } catch {
                region.lastHealthCheck = Date.now();
                // Still unhealthy — continue
            }
        }
    }, RECOVERY_CHECK_INTERVAL_MS);
}
