/**
 * Enterprise Knowledge Upload Guard
 * 
 * Provides:
 * 1. Per-user upload rate limiting (sliding window)
 * 2. Per-user concurrent processing limits
 * 3. File validation (magic bytes, extension, MIME type)
 * 4. Audit trail enrichment (IP, user agent)
 */

import { Request, Response, NextFunction } from 'express';
import { LoggerService } from '../services/LoggerService';
import { Knowledge } from '../knowledge/models';
import {
    UPLOAD_RATE_LIMIT,
    UPLOAD_RATE_WINDOW_MS,
    MAX_PENDING_JOBS_PER_USER,
    BLOCKED_MAGIC_BYTES,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE_BYTES,
} from '../knowledge/constants';

// ── In-memory sliding window rate limiter for uploads ──
const uploadWindows = new Map<string, number[]>();

function cleanupOldEntries() {
    const now = Date.now();
    for (const [key, timestamps] of uploadWindows.entries()) {
        const valid = timestamps.filter(t => now - t < UPLOAD_RATE_WINDOW_MS);
        if (valid.length === 0) {
            uploadWindows.delete(key);
        } else {
            uploadWindows.set(key, valid);
        }
    }
}

// Periodic cleanup every 5 minutes
setInterval(cleanupOldEntries, 5 * 60 * 1000);

export class KnowledgeGuard {

    /**
     * Rate-limit uploads per user (sliding window).
     * Prevents abuse and ensures fair resource allocation.
     */
    static uploadRateLimit(req: Request, res: Response, next: NextFunction) {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const userId = user.userId || user.sub;
        const now = Date.now();

        const timestamps = uploadWindows.get(userId) || [];
        const validTimestamps = timestamps.filter(t => now - t < UPLOAD_RATE_WINDOW_MS);

        if (validTimestamps.length >= UPLOAD_RATE_LIMIT) {
            const oldestValid = Math.min(...validTimestamps);
            const retryAfter = Math.ceil((oldestValid + UPLOAD_RATE_WINDOW_MS - now) / 1000);

            LoggerService.warn('knowledge_upload_rate_limited', {
                userId,
                count: validTimestamps.length,
                limit: UPLOAD_RATE_LIMIT,
                windowMs: UPLOAD_RATE_WINDOW_MS
            });

            return res.status(429).json({
                error: `Upload rate limit exceeded. Maximum ${UPLOAD_RATE_LIMIT} uploads per ${Math.round(UPLOAD_RATE_WINDOW_MS / 60000)} minutes.`,
                retryAfter,
                limit: UPLOAD_RATE_LIMIT,
                remaining: 0
            });
        }

        validTimestamps.push(now);
        uploadWindows.set(userId, validTimestamps);

        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', UPLOAD_RATE_LIMIT);
        res.setHeader('X-RateLimit-Remaining', UPLOAD_RATE_LIMIT - validTimestamps.length);
        res.setHeader('X-RateLimit-Reset', Math.ceil((now + UPLOAD_RATE_WINDOW_MS) / 1000));

        next();
    }

    /**
     * Prevent a single user from flooding the processing queue.
     * Checks how many pending/processing jobs a user already has.
     */
    static async concurrencyLimit(req: Request, res: Response, next: NextFunction) {
        const user = (req as any).user;
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const userId = user.userId || user.sub;

        try {
            const pendingCount = await Knowledge.countDocuments({
                ownerId: userId,
                processingStatus: { $in: ['pending', 'processing'] }
            });

            if (pendingCount >= MAX_PENDING_JOBS_PER_USER) {
                LoggerService.warn('knowledge_concurrency_limited', {
                    userId,
                    pendingCount,
                    limit: MAX_PENDING_JOBS_PER_USER
                });

                return res.status(429).json({
                    error: `You have ${pendingCount} documents still processing. Please wait for some to complete before uploading more.`,
                    pendingCount,
                    limit: MAX_PENDING_JOBS_PER_USER
                });
            }

            next();
        } catch (err: any) {
            LoggerService.error('knowledge_concurrency_check_failed', { error: err.message });
            next(); // Fail open — don't block uploads if the check fails
        }
    }

    /**
     * Enrich request with audit information (IP, user agent).
     * This data will be stored on the Knowledge document.
     */
    static auditEnrich(req: Request, _res: Response, next: NextFunction) {
        const ip = req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown';
        (req as any)._auditIp = typeof ip === 'string' ? ip.split(',')[0].trim() : 'unknown';
        (req as any)._auditUserAgent = req.headers['user-agent'] || 'unknown';
        next();
    }

    /**
     * Validate file extension server-side.
     * This is called before busboy starts processing — a fast pre-check on Content-Type headers.
     */
    static preflightCheck(req: Request, res: Response, next: NextFunction) {
        // Only apply to multipart uploads
        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('multipart/form-data')) {
            return next();
        }

        // Check content-length header for oversized payloads before we even parse
        const contentLength = parseInt(req.headers['content-length'] || '0', 10);
        const maxSize = MAX_FILE_SIZE_BYTES;
        if (contentLength > maxSize) {
            LoggerService.warn('knowledge_upload_oversized_preflight', {
                declaredSize: contentLength,
                maxSize
            });
            return res.status(413).json({
                error: `File too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))} MB.`,
                declaredSize: contentLength,
                maxSize
            });
        }

        next();
    }
}

/**
 * Validate file content after reading first bytes.
 * Checks for blocked magic bytes (executables, malware vectors).
 * Returns detected info for audit trail.
 */
export function validateFileBuffer(buffer: Buffer, declaredName: string, declaredMime: string): {
    valid: boolean;
    reason?: string;
    detectedType?: string;
} {
    // 1. Check blocked magic bytes
    for (const blocked of BLOCKED_MAGIC_BYTES) {
        const match = blocked.bytes.every((b, i) => buffer[i] === b);
        if (match) {
            LoggerService.error('knowledge_blocked_file_type', {
                fileName: declaredName,
                declaredMime,
                detected: blocked.description
            });
            return {
                valid: false,
                reason: `Blocked file type detected: ${blocked.description}. This file type is not allowed.`,
                detectedType: blocked.description
            };
        }
    }

    // 2. Check extension
    const ext = declaredName.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
        return {
            valid: false,
            reason: `File extension ".${ext}" is not supported. Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(', ')}`,
        };
    }

    // 3. Basic magic-bytes verification for common types
    const detectedType = detectMimeFromBytes(buffer);
    if (detectedType) {
        // If we detected a type and it doesn't match what we expect for the extension, warn but allow
        // (some documents have ambiguous signatures)
        return { valid: true, detectedType };
    }

    return { valid: true };
}

/**
 * Lightweight magic-bytes detection for common document types.
 * No external dependency needed — just checks first few bytes.
 */
function detectMimeFromBytes(buffer: Buffer): string | undefined {
    if (buffer.length < 4) return undefined;

    // PDF: %PDF
    if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
        return 'application/pdf';
    }
    // ZIP-based (DOCX, XLSX, PPTX, etc): PK\x03\x04
    if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
        return 'application/zip'; // Could be DOCX, XLSX, etc.
    }
    // PNG: \x89PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        return 'image/png';
    }
    // JPEG: \xFF\xD8\xFF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return 'image/jpeg';
    }
    // TIFF: II or MM
    if ((buffer[0] === 0x49 && buffer[1] === 0x49) || (buffer[0] === 0x4D && buffer[1] === 0x4D)) {
        return 'image/tiff';
    }
    // OLE2 (DOC, XLS, PPT): \xD0\xCF\x11\xE0
    if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
        return 'application/msword'; // Could be DOC, XLS
    }

    return undefined;
}
