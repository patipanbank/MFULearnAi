import { minioClient } from '../knowledge/minioClient';
import { LoggerService } from './LoggerService';

const CHAT_BUCKET = 'chat-attachments';
const MAX_ATTACHMENT_SIZE = 25 * 1024 * 1024; // 25 MB per file

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

export class ChatAttachmentService {
    static async uploadFile(buffer: Buffer, filename: string, mimeType: string, userId: string, role: string = 'student'): Promise<any> {
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
                .replace(/\.[^.]+$/, '') // Remove extension
                .replace(/[^a-zA-Z0-9_-]/g, '_') // Keep only safe chars
                .substring(0, 40);
            const safeFilename = `${Date.now()}_${safeBase}.${ext}`;

            // Key format: userId/safeFilename determines ownership
            const s3Key = `${userId}/${safeFilename}`;

            LoggerService.info('chat_attachment_upload_start', {
                originalName: filename,
                size: buffer.length,
                key: s3Key
            }, userId);

            await minioClient.putObject(CHAT_BUCKET, s3Key, buffer, buffer.length, {
                'Content-Type': mimeType,
                'x-amz-meta-original-name': encodeURIComponent(filename),
                'x-amz-meta-user-id': userId,
                'x-amz-meta-role': role
            });

            return {
                key: s3Key,
                filename: safeFilename,
                originalName: filename,
                mimeType,
                size: buffer.length,
                bucket: CHAT_BUCKET
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

    static async streamAttachment(key: string, res: any, userId: string, role: string = 'student'): Promise<void> {
        await ensureBucket();

        try {
            const stat = await minioClient.statObject(CHAT_BUCKET, key);

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

            const stream = await minioClient.getObject(CHAT_BUCKET, key);
            (stream as any).pipe(res);
        } catch (error: any) {
            LoggerService.error('chat_attachment_download_failed', {
                key,
                error: error.message
            }, userId);
            throw error;
        }
    }
}
