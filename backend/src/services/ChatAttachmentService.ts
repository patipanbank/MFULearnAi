import { minioClient } from '../knowledge/minioClient';
import { LoggerService } from './LoggerService';

const CHAT_BUCKET = 'chat-attachments';

export class ChatAttachmentService {
    static async uploadFile(buffer: Buffer, filename: string, mimeType: string, userId: string, role: string = 'student'): Promise<any> {
        try {
            // Sanitize filename for transport
            const ext = filename.split('.').pop() || 'dat';
            const safeBase = filename.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
            const safeFilename = `${Date.now()}_${safeBase}.${ext}`;

            // Key format: userId/safeFilename determines ownership
            const s3Key = `${userId}/${safeFilename}`;

            console.log(`[ChatAttachment] Uploading ${filename} to MinIO bucket ${CHAT_BUCKET} as ${s3Key}`);

            await minioClient.putObject(CHAT_BUCKET, s3Key, buffer, buffer.length, {
                'Content-Type': mimeType,
                'x-amz-meta-original-name': filename,
                'x-amz-meta-user-id': userId,
                'x-amz-meta-role': role
            });

            return {
                key: s3Key,
                filename: safeFilename,
                originalName: filename,
                mimeType: mimeType,
                size: buffer.length,
                bucket: CHAT_BUCKET
            };
        } catch (error: any) {
            LoggerService.error('chat_attachment_upload_failed', {
                filename,
                error: error.message
            }, userId);
            throw error;
        }
    }

    static async streamAttachment(key: string, res: any, userId: string, role: string = 'student'): Promise<void> {
        try {
            const stat = await minioClient.statObject(CHAT_BUCKET, key);

            // Minio stat metadata keys are often lowercased
            const contentType = stat.metaData['content-type'] || 'application/octet-stream';

            res.setHeader('Content-Type', contentType);
            if (stat.size) {
                res.setHeader('Content-Length', stat.size);
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
