import { Response } from 'express';
import crypto from 'crypto';
import { minioClient } from '../knowledge/minioClient';
import { LoggerService } from './LoggerService';

const CHAT_BUCKET = 'chat-attachments';
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB per file

/** Typed return value for uploadFile — replaces `any` */
export interface AttachmentMetadata {
    key: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    bucket: string;
    originalFileHash: string;
}

// Lazy bucket creation flag — avoids repeated HEAD requests
let bucketVerified = false;

async function ensureBucket(): Promise<void> {
    if (bucketVerified) return;
    try {
        const exists = await minioClient.bucketExists(CHAT_BUCKET);
        if (!exists) {
            await minioClient.makeBucket(CHAT_BUCKET);
            LoggerService.info('chat_attachment_bucket_created', { bucket: CHAT_BUCKET });
        }
        bucketVerified = true;
    } catch (error: any) {
        LoggerService.error('chat_attachment_bucket_check_failed', { error: error.message });
        throw new Error(`Storage bucket unavailable: ${error.message}`);
    }
}

/**
 * Sanitize and validate the S3 key to prevent path traversal attacks.
 * Returns a clean key or throws if the key attempts directory traversal.
 */
function sanitizeKey(key: string): string {
    // Normalize backslashes to forward slashes
    let normalized = key.replace(/\\/g, '/');

    // Block path traversal sequences before normalization can hide them
    if (normalized.includes('..') || normalized.includes('//')) {
        throw new Error('Invalid key: path traversal detected');
    }

    // Remove leading slash if present
    normalized = normalized.replace(/^\/+/, '');

    return normalized;
}

export class ChatAttachmentService {
    /**
     * Upload a file buffer to MinIO and return the attachment metadata.
     *
     * @param buffer - Raw file content
     * @param filename - Original filename from the client
     * @param mimeType - MIME type (e.g. 'application/pdf')
     * @param userId - Owner ID — used as key prefix for access control
     */
    static async uploadFile(
        buffer: Buffer,
        filename: string,
        mimeType: string,
        userId: string
    ): Promise<AttachmentMetadata> {
        if (!buffer || buffer.length === 0) {
            throw new Error('Empty file buffer');
        }
        if (buffer.length > MAX_ATTACHMENT_SIZE) {
            throw new Error(`File size ${(buffer.length / (1024 * 1024)).toFixed(1)} MB exceeds limit of ${MAX_ATTACHMENT_SIZE / (1024 * 1024)} MB`);
        }

        await ensureBucket();

        try {
            // Sanitize filename for safe storage key
            const ext = filename.split('.').pop()?.toLowerCase() || 'dat';
            const safeBase = filename
                .replace(/\.[^.]+$/, '')        // Remove extension
                .replace(/[^a-zA-Z0-9\u0E00-\u0E7F_\-\s]/g, '_') // Keep alphanumeric, Thai, underscores, hyphens, spaces
                .replace(/\s+/g, '_')           // Collapse spaces to underscore
                .substring(0, 60);
            const safeFilename = `${Date.now()}_${safeBase || 'file'}.${ext}`;

            // Key format: userId/safeFilename — ownership determined by prefix
            const s3Key = `${userId}/${safeFilename}`;

            const hash = crypto.createHash('sha256').update(buffer).digest('hex');

            LoggerService.info('chat_attachment_upload_start', {
                originalName: filename,
                size: buffer.length,
                key: s3Key
            }, userId);

            await minioClient.putObject(CHAT_BUCKET, s3Key, buffer, buffer.length, {
                'Content-Type': mimeType,
                'x-amz-meta-original-name': encodeURIComponent(filename),
                'x-amz-meta-user-id': userId,
                'x-amz-meta-file-sha256': hash
            });

            return {
                key: s3Key,
                filename: safeFilename,
                originalName: filename,
                mimeType,
                size: buffer.length,
                bucket: CHAT_BUCKET,
                originalFileHash: hash
            };
        } catch (error: any) {
            LoggerService.error('chat_attachment_upload_failed', {
                filename,
                size: buffer.length,
                error: error.message
            }, userId);
            throw error;
        }
    }

    /**
     * Stream an attachment from MinIO directly to the HTTP response.
     * Caller (ChatController) MUST validate key ownership before calling this.
     *
     * @param key - S3 object key (must be sanitized by caller)
     * @param res - Express Response object for streaming
     * @param userId - Requesting user ID (for logging)
     */
    static async streamAttachment(key: string, res: Response, userId: string): Promise<void> {
        await ensureBucket();

        // Defense-in-depth: sanitize key even though controller should have validated
        const safeKey = sanitizeKey(key);

        try {
            const stat = await minioClient.statObject(CHAT_BUCKET, safeKey);

            // MinIO stat metadata keys are lowercased
            const contentType = stat.metaData?.['content-type'] || 'application/octet-stream';
            const originalName = stat.metaData?.['x-amz-meta-original-name'];

            res.setHeader('Content-Type', contentType);
            if (stat.size) {
                res.setHeader('Content-Length', stat.size);
            }
            if (originalName) {
                res.setHeader('Content-Disposition', `inline; filename="${decodeURIComponent(originalName)}"`);
            }

            const stream = await minioClient.getObject(CHAT_BUCKET, safeKey);

            // Handle stream errors to prevent hanging response
            stream.on('error', (err) => {
                LoggerService.error('chat_attachment_stream_error', {
                    key: safeKey,
                    error: err instanceof Error ? err.message : 'Stream error'
                }, userId);

                if (!res.headersSent) {
                    res.status(500).json({ error: 'Stream failed' });
                } else {
                    res.end();
                }
            });

            stream.pipe(res);
        } catch (error: any) {
            LoggerService.error('chat_attachment_download_failed', {
                key: safeKey,
                error: error.message
            }, userId);
            throw error;
        }
    }

    /**
     * Validate that a key belongs to the given userId.
     * Use this in controllers before calling streamAttachment.
     */
    static validateKeyOwnership(key: string, userId: string): boolean {
        try {
            const safeKey = sanitizeKey(key);
            return safeKey.startsWith(`${userId}/`);
        } catch {
            // sanitizeKey throws on path traversal → ownership check fails
            return false;
        }
    }
}
