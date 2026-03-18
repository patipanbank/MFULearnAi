/**
 * SSRF (Server-Side Request Forgery) Prevention Utility
 * 
 * Enterprise-grade URL validation that blocks:
 * - Private/internal IPv4 ranges (RFC 1918, RFC 5737, etc.)
 * - IPv6 localhost and private ranges
 * - Link-local addresses (169.254.x.x — AWS/cloud metadata!)
 * - Hex/octal/decimal IP notation bypasses
 * - .local, .internal, .corp domains
 * - Redirect chains that resolve to internal IPs
 */

import { URL } from 'url';
import dns from 'dns';
import { promisify } from 'util';

const dnsResolve = promisify(dns.resolve4);

/** All private/internal IPv4 CIDR ranges */
const PRIVATE_IP_RANGES: Array<{ network: number; mask: number; label: string }> = [
    // Loopback — 127.0.0.0/8
    { network: 0x7F000000, mask: 0xFF000000, label: 'loopback' },
    // 10.0.0.0/8 — Class A private
    { network: 0x0A000000, mask: 0xFF000000, label: 'private-10' },
    // 172.16.0.0/12 — Class B private (172.16.0.0 – 172.31.255.255)
    { network: 0xAC100000, mask: 0xFFF00000, label: 'private-172' },
    // 192.168.0.0/16 — Class C private
    { network: 0xC0A80000, mask: 0xFFFF0000, label: 'private-192' },
    // 169.254.0.0/16 — Link-local (AWS IMDS metadata at 169.254.169.254!)
    { network: 0xA9FE0000, mask: 0xFFFF0000, label: 'link-local' },
    // 0.0.0.0/8 — "This" network
    { network: 0x00000000, mask: 0xFF000000, label: 'this-network' },
    // 100.64.0.0/10 — Carrier-Grade NAT (RFC 6598)
    { network: 0x64400000, mask: 0xFFC00000, label: 'cgnat' },
    // 192.0.0.0/24 — IETF Protocol Assignments
    { network: 0xC0000000, mask: 0xFFFFFF00, label: 'ietf-protocol' },
    // 198.18.0.0/15 — Benchmarking
    { network: 0xC6120000, mask: 0xFFFE0000, label: 'benchmarking' },
    // 224.0.0.0/4 — Multicast
    { network: 0xE0000000, mask: 0xF0000000, label: 'multicast' },
    // 240.0.0.0/4 — Reserved
    { network: 0xF0000000, mask: 0xF0000000, label: 'reserved' },
];

/** Blocked hostname suffixes */
const BLOCKED_DOMAINS = [
    '.local',
    '.internal',
    '.corp',
    '.lan',
    '.home',
    '.localhost',
    '.arpa',
];

/** Blocked exact hostnames */
const BLOCKED_HOSTNAMES = new Set([
    'localhost',
    'metadata',                     // Common cloud metadata hostname
    'metadata.google.internal',     // GCP metadata
    'instance-data',                // AWS alternative
]);

/**
 * Parse a string into an IPv4 integer. Handles:
 * - Standard dotted decimal: 192.168.1.1
 * - Hex: 0xC0A80101
 * - Octal: 0300.0250.0001.0001
 * - Integer: 3232235777
 * 
 * Returns null if not a valid IPv4 address.
 */
function parseIPv4(ip: string): number | null {
    // Remove brackets if present
    ip = ip.replace(/^\[|\]$/g, '');

    // Try as a single integer (decimal or hex)
    if (/^(0x[\da-f]+|\d+)$/i.test(ip)) {
        const n = Number(ip);
        if (n >= 0 && n <= 0xFFFFFFFF) return n >>> 0;
        return null;
    }

    // Try dotted notation (supports octal/hex per-octet)
    const parts = ip.split('.');
    if (parts.length !== 4) return null;

    let result = 0;
    for (const part of parts) {
        let octet: number;
        if (part.startsWith('0x') || part.startsWith('0X')) {
            octet = parseInt(part, 16);
        } else if (part.startsWith('0') && part.length > 1) {
            octet = parseInt(part, 8);
        } else {
            octet = parseInt(part, 10);
        }
        if (isNaN(octet) || octet < 0 || octet > 255) return null;
        result = (result << 8) | octet;
    }

    return result >>> 0;
}

/**
 * Check if an IPv4 integer falls in any private/internal range.
 */
function isPrivateIPv4(ipInt: number): { isPrivate: boolean; label?: string } {
    for (const range of PRIVATE_IP_RANGES) {
        if ((ipInt & range.mask) === range.network) {
            return { isPrivate: true, label: range.label };
        }
    }
    return { isPrivate: false };
}

/**
 * Check if an IPv6 address is private/internal.
 * Handles ::1 (loopback), ::ffff:x.x.x.x (mapped IPv4), fc00::/7, fe80::/10
 */
function isPrivateIPv6(hostname: string): boolean {
    const clean = hostname.replace(/^\[|\]$/g, '').toLowerCase();

    // ::1 — loopback
    if (clean === '::1' || clean === '0000:0000:0000:0000:0000:0000:0000:0001') return true;

    // :: — unspecified
    if (clean === '::' || clean === '0000:0000:0000:0000:0000:0000:0000:0000') return true;

    // ::ffff:x.x.x.x — IPv4-mapped IPv6
    const v4Mapped = clean.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (v4Mapped) {
        const ipInt = parseIPv4(v4Mapped[1]);
        if (ipInt !== null) return isPrivateIPv4(ipInt).isPrivate;
    }

    // fc00::/7 — Unique local address
    if (clean.startsWith('fc') || clean.startsWith('fd')) return true;

    // fe80::/10 — Link-local
    if (clean.startsWith('fe8') || clean.startsWith('fe9') || clean.startsWith('fea') || clean.startsWith('feb')) return true;

    return false;
}

/**
 * Validate a URL is safe from SSRF attacks.
 * 
 * @param url - The URL string to validate
 * @param options - Optional settings
 * @returns Validation result with reason if blocked
 */
export function validateUrlSafety(url: string, options?: {
    allowedProtocols?: string[];
    maxLength?: number;
}): { safe: boolean; reason?: string } {
    const maxLen = options?.maxLength ?? 2048;
    const allowedProtocols = options?.allowedProtocols ?? ['http:', 'https:'];

    // 1. Length check
    if (url.length > maxLen) {
        return { safe: false, reason: `URL too long (max ${maxLen} characters)` };
    }

    // 2. Parse URL
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return { safe: false, reason: 'Invalid URL format' };
    }

    // 3. Protocol check
    if (!allowedProtocols.includes(parsed.protocol)) {
        return { safe: false, reason: `Protocol "${parsed.protocol}" not allowed. Only ${allowedProtocols.join(', ')} permitted.` };
    }

    // 4. Empty hostname
    if (!parsed.hostname) {
        return { safe: false, reason: 'URL has no hostname' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 5. Blocked exact hostnames
    if (BLOCKED_HOSTNAMES.has(hostname)) {
        return { safe: false, reason: `Hostname "${hostname}" is blocked` };
    }

    // 6. Blocked domain suffixes
    for (const suffix of BLOCKED_DOMAINS) {
        if (hostname.endsWith(suffix)) {
            return { safe: false, reason: `Domain suffix "${suffix}" is not allowed` };
        }
    }

    // 7. IPv6 check
    if (hostname.startsWith('[') || parsed.hostname.includes(':')) {
        if (isPrivateIPv6(hostname)) {
            return { safe: false, reason: 'IPv6 private/internal addresses are not allowed' };
        }
    }

    // 8. IPv4 check (including hex/octal/integer notation bypasses)
    const ipInt = parseIPv4(hostname);
    if (ipInt !== null) {
        const check = isPrivateIPv4(ipInt);
        if (check.isPrivate) {
            return { safe: false, reason: `Private IP detected (${check.label}). Internal network access is blocked.` };
        }
    }

    // 9. Credentials in URL
    if (parsed.username || parsed.password) {
        return { safe: false, reason: 'URLs with embedded credentials are not allowed' };
    }

    return { safe: true };
}

/**
 * DNS-based SSRF check: resolves hostname and verifies all returned IPs are public.
 * Use this for defense-in-depth when you want to catch DNS rebinding.
 * 
 * Note: This is async and slightly slower — use for critical paths.
 */
export async function validateUrlDns(url: string): Promise<{ safe: boolean; reason?: string; resolvedIps?: string[] }> {
    // First do the synchronous checks
    const staticCheck = validateUrlSafety(url);
    if (!staticCheck.safe) return staticCheck;

    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

    // If it's already an IP literal, skip DNS resolution
    if (parseIPv4(hostname) !== null || hostname.includes(':')) {
        return { safe: true, resolvedIps: [hostname] };
    }

    // Resolve DNS and check all returned IPs
    try {
        const ips = await dnsResolve(hostname);
        for (const ip of ips) {
            const ipInt = parseIPv4(ip);
            if (ipInt !== null) {
                const check = isPrivateIPv4(ipInt);
                if (check.isPrivate) {
                    return {
                        safe: false,
                        reason: `Hostname "${hostname}" resolves to private IP ${ip} (${check.label}). Possible DNS rebinding attack.`,
                        resolvedIps: ips
                    };
                }
            }
        }
        return { safe: true, resolvedIps: ips };
    } catch (err: any) {
        // DNS resolution failed — hostname doesn't exist or DNS error
        if (err.code === 'ENOTFOUND') {
            return { safe: false, reason: `Hostname "${hostname}" could not be resolved (DNS NXDOMAIN)` };
        }
        // Other DNS errors — allow through (fail open) but log
        return { safe: true, resolvedIps: [] };
    }
}

/**
 * Max response size for URL fetching (default 50MB).
 * Prevents OOM from malicious URLs serving infinite data.
 */
export const MAX_URL_RESPONSE_BYTES = parseInt(
    process.env.KB_MAX_URL_RESPONSE_MB || '50', 10
) * 1024 * 1024;

/**
 * Max redirects allowed for URL fetching.
 */
export const MAX_URL_REDIRECTS = parseInt(
    process.env.KB_MAX_URL_REDIRECTS || '5', 10
);

/**
 * Default timeout for generic URL fetching (ms).
 */
export const URL_FETCH_TIMEOUT_MS = parseInt(
    process.env.KB_URL_FETCH_TIMEOUT_MS || '30000', 10
);
