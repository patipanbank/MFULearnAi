
import axios from '../config/axios';
import FormData from 'form-data';
import { TokenService } from './TokenService';
import { LoggerService } from './LoggerService';

const KNOWLEDGE_URL = process.env.KNOWLEDGE_URL || 'http://localhost:7000/api/knowledge';

export class ChatAttachmentService {
    static async uploadFile(buffer: Buffer, filename: string, mimeType: string, userId: string, role: string = 'student'): Promise<any> {
        try {
            const formData = new FormData();
            // Sanitize filename for transport to avoid header encoding issues
            // Keep extension, replace rest with simple timestamp or uuid-ish
            const ext = filename.split('.').pop() || 'dat';
            const safeBase = filename.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20); // truncate
            const safeFilename = `${Date.now()}_${safeBase}.${ext}`;

            // Add original filename as known metadata field if supported, or just rely on Orchestrator to track it
            // Actually, we pass it in the options, but FormData headers are finicky.
            formData.append('file', buffer, { filename: safeFilename, contentType: mimeType }); // Transport safe name

            const headers = {
                ...formData.getHeaders(),
                'x-user-id': userId,
                'x-role': role,
                'Authorization': `Bearer ${TokenService.mint('knowledge', 'write')}`
            };

            // Construct Storage URL
            // Assumes KNOWLEDGE_URL ends with /api/knowledge
            const baseURL = KNOWLEDGE_URL.replace(/\/api\/knowledge\/?$/, '');
            const uploadURL = `${baseURL}/api/storage/upload`;

            console.log(`[ChatAttachment] Uploading ${filename} to ${uploadURL}`);

            const response = await axios.post(uploadURL, formData, {
                headers,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                timeout: 30000 // 30s timeout
            });

            if (response.data && response.data.success) {
                return response.data.data;
            }
            throw new Error(response.data?.error || 'Upload failed');
        } catch (error: any) {
            LoggerService.error('chat_attachment_upload_failed', {
                filename,
                error: error.message,
                response: error.response?.data
            }, userId);
            // Don't throw? Or throw?
            // If upload fails, should we fail the whole chat? request?
            // User requirement: "Persist chat files". If persistence fails, maybe just log warning and continue with ephemeral processing?
            // "Security-critical logic must fail closed." - This is data persistence.
            // But if specific feature fails, maybe fail gracefully.
            // I'll throw and let caller decide.
            throw error;
        }
    }

    static async streamAttachment(key: string, res: any, userId: string, role: string = 'student'): Promise<void> {
        try {
            const baseURL = KNOWLEDGE_URL.replace(/\/api\/knowledge\/?$/, ''); // e.g. http://knowledge-service:7000
            const url = `${baseURL}/api/storage/file/${key}`;

            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'stream',
                headers: {
                    'x-user-id': userId,
                    'x-role': role,
                    'Authorization': `Bearer ${TokenService.mint('knowledge', 'read')}`
                }
            });

            if (response.headers['content-type']) {
                res.setHeader('Content-Type', response.headers['content-type']);
            }
            if (response.headers['content-length']) {
                res.setHeader('Content-Length', response.headers['content-length']);
            }

            response.data.pipe(res);
        } catch (error: any) {
            LoggerService.error('chat_attachment_download_failed', {
                key,
                error: error.message
            }, userId);
            throw error;
        }
    }
}
