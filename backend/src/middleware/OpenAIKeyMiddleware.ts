/**
 * OpenAI API Key Middleware — Per-key rate limit, quota, and IP allowlisting.
 *
 * Replaces the old hardcoded ApiKeyLimiter for /v1/* endpoints.
 * Reads limits from the ApiKey document (per-key configurable).
 */

import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { ApiKeyUsageService } from '../services/ApiKeyUsageService';
import { IApiKey } from '../models/ApiKey';
import net from 'net';

/**
 * Check if an IP matches a CIDR range or exact IP.
 */
function ipMatchesCIDR(ip: string, cidr: string): boolean {
    if (cidr === ip) return true;
    if (!cidr.includes('/')) return cidr === ip;

    const [range, bits] = cidr.split('/');
    const mask = ~(Math.pow(2, 32 - parseInt(bits)) - 1);

    function ipToInt(ipStr: string): number {
        return ipStr.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    }

    if (!net.isIPv4(ip) || !net.isIPv4(range)) return false;
    return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
}

/**
 * Extract client IP from request.
 */
function getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    return req.ip || req.socket.remoteAddress || '';
}

/**
 * Middleware: IP Allowlisting
 * Checks if the request IP is in the key's allowedIPs list.
 */
export async function ipAllowlistCheck(req: Request, res: Response, next: NextFunction) {
    const apiKey: IApiKey | undefined = (req as any).apiKey;
    if (!apiKey) return next(); // No API key context, skip

    const allowedIPs = apiKey.allowedIPs || [];
    if (allowedIPs.length === 0) return next(); // No restrictions

    const clientIP = getClientIP(req);

    const isAllowed = allowedIPs.some(allowed => {
        if (allowed === '*') return true;
        return ipMatchesCIDR(clientIP, allowed);
    });

    if (!isAllowed) {
        return res.status(403).json({
            error: {
                message: `IP address ${clientIP} is not allowed for this API key.`,
                type: 'permission_error',
                code: 'ip_not_allowed',
            },
        });
    }

    // Store IP for logging
    (req as any).clientIP = clientIP;
    next();
}

/**
 * Middleware: Per-key Rate Limiting (requests per minute + per hour).
 * Uses Redis sliding window.
 */
export async function perKeyRateLimit(req: Request, res: Response, next: NextFunction) {
    const apiKey: IApiKey | undefined = (req as any).apiKey;
    if (!apiKey) return next();

    const keyId = apiKey._id?.toString();
    if (!keyId) return next();

    const rateLimit = apiKey.rateLimit || { requestsPerHour: 1000, requestsPerMinute: 60 };

    try {
        const now = Math.floor(Date.now() / 1000);

        // ── Per-minute check ──
        if (rateLimit.requestsPerMinute > 0) {
            const minuteKey = `rl:m:${keyId}:${Math.floor(now / 60)}`;
            const minuteCount = await redis.incr(minuteKey);
            if (minuteCount === 1) await redis.expire(minuteKey, 120);

            if (minuteCount > rateLimit.requestsPerMinute) {
                const retryAfter = 60 - (now % 60);
                res.setHeader('Retry-After', retryAfter.toString());
                res.setHeader('X-RateLimit-Limit-Requests', rateLimit.requestsPerMinute.toString());
                res.setHeader('X-RateLimit-Remaining-Requests', '0');
                res.setHeader('X-RateLimit-Reset-Requests', `${retryAfter}s`);
                return res.status(429).json({
                    error: {
                        message: `Rate limit exceeded: ${rateLimit.requestsPerMinute} requests per minute.`,
                        type: 'rate_limit_error',
                        code: 'rate_limit_exceeded',
                    },
                });
            }
        }

        // ── Per-hour check ──
        if (rateLimit.requestsPerHour > 0) {
            const hourKey = `rl:h:${keyId}:${Math.floor(now / 3600)}`;
            const hourCount = await redis.incr(hourKey);
            if (hourCount === 1) await redis.expire(hourKey, 7200);

            res.setHeader('X-RateLimit-Limit-Requests', rateLimit.requestsPerHour.toString());
            res.setHeader('X-RateLimit-Remaining-Requests', Math.max(0, rateLimit.requestsPerHour - hourCount).toString());

            if (hourCount > rateLimit.requestsPerHour) {
                const retryAfter = 3600 - (now % 3600);
                res.setHeader('Retry-After', retryAfter.toString());
                return res.status(429).json({
                    error: {
                        message: `Rate limit exceeded: ${rateLimit.requestsPerHour} requests per hour.`,
                        type: 'rate_limit_error',
                        code: 'rate_limit_exceeded',
                    },
                });
            }
        }

        next();
    } catch (error) {
        console.error('[PerKeyRateLimit] Redis error, failing open:', error);
        next(); // Fail open
    }
}

/**
 * Middleware: Per-key Token Quota (daily + monthly budget).
 */
export async function perKeyQuotaCheck(req: Request, res: Response, next: NextFunction) {
    const apiKey: IApiKey | undefined = (req as any).apiKey;
    if (!apiKey) return next();

    const keyId = apiKey._id?.toString();
    if (!keyId) return next();

    try {
        // ── Daily limit check ──
        const dailyLimit = apiKey.dailyTokenLimit || (apiKey.rateLimit?.tokensPerDay || 0);
        if (dailyLimit > 0) {
            const dailyUsage = await ApiKeyUsageService.getDailyUsage(keyId);
            if (dailyUsage >= dailyLimit) {
                return res.status(429).json({
                    error: {
                        message: `Daily token quota exceeded (${dailyUsage.toLocaleString()} / ${dailyLimit.toLocaleString()} weighted tokens).`,
                        type: 'rate_limit_error',
                        code: 'daily_quota_exceeded',
                    },
                    usage: { daily: dailyUsage, dailyLimit },
                });
            }
            res.setHeader('X-RateLimit-Limit-Tokens', dailyLimit.toString());
            res.setHeader('X-RateLimit-Remaining-Tokens', Math.max(0, dailyLimit - dailyUsage).toString());
        }

        // ── Monthly budget check ──
        const monthlyBudget = apiKey.monthlyBudget || (apiKey.rateLimit?.tokensPerMonth || 0);
        if (monthlyBudget > 0) {
            const monthlyUsage = await ApiKeyUsageService.getMonthlyUsage(keyId);
            if (monthlyUsage >= monthlyBudget) {
                return res.status(429).json({
                    error: {
                        message: `Monthly budget exceeded (${monthlyUsage.toLocaleString()} / ${monthlyBudget.toLocaleString()} weighted tokens).`,
                        type: 'rate_limit_error',
                        code: 'monthly_budget_exceeded',
                    },
                    usage: { monthly: monthlyUsage, monthlyBudget },
                });
            }
        }

        next();
    } catch (error) {
        console.error('[PerKeyQuotaCheck] Error, failing open:', error);
        next();
    }
}

/**
 * Combined middleware stack for /v1/* endpoints.
 * Applies IP check → rate limit → quota in sequence.
 */
export const openaiApiKeyMiddleware = [ipAllowlistCheck, perKeyRateLimit, perKeyQuotaCheck];
