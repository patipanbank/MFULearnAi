import { Request, Response } from 'express';
import crypto from 'crypto';
import busboy from 'busboy';
import { KnowledgeService } from '../services/KnowledgeService';
import { HistoryService } from '../services/HistoryService';
import { BedrockService } from '../services/BedrockService';
import { Conversation } from '../models/Conversation';
import { LoggerService } from '../services/LoggerService';
import { ContextService } from '../services/ContextService';
import { ChatAttachmentService } from '../services/ChatAttachmentService';
import { validateFileBuffer } from '../middleware/knowledgeGuard';
import { ALLOWED_EXTENSIONS } from '../knowledge/constants';

// Chat attachment limits (per request)
const MAX_CHAT_FILES = parseInt(process.env.CHAT_MAX_FILES || '10', 10);
const MAX_CHAT_FILE_SIZE = parseInt(process.env.CHAT_MAX_FILE_MB || '25', 10) * 1024 * 1024;
const MAX_CHAT_TOTAL_SIZE = parseInt(process.env.CHAT_MAX_TOTAL_MB || '100', 10) * 1024 * 1024;

export class ChatController {
    static async chat(req: any, res: Response) {
        const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
        const userId = req.user.userId;
        const respondOnce = (status: number, message: string) => {
            if (res.headersSent) return true;
            res.status(status).json({ error: message });
            return true;
        };

        let message = '';
        let sessionId = '';
        let modelId = '';
        let collectionId = '';
        let context = '';
        let scenarioId = '';
        let images: any[] = [];
        let files: any[] = [];
        let mode: 'chat' | 'agent' = 'chat';

        // Capture context from request (preserved from middleware)
        const correlationId = (req.headers['x-correlation-id'] as string) || 'unknown';

        let totalFileBytes = 0;
        let fileCount = 0;
        let rejected = false;

        const executeAgent = () => {
            if (rejected) return;
            ContextService.run({ correlationId }, async () => {
                const actualSessionId = sessionId || crypto.randomUUID();
                if (!message && (!images || images.length === 0) && (!files || files.length === 0)) {
                    return res.status(400).json({ error: 'Message or attachment is required' });
                }

                try {
                    // Generate an initial title from the message if it's a new session
                    const initialTitle = message ? (message.length > 40 ? message.substring(0, 40) + '...' : message) : 'New Conversation';

                    // Commit skeletal session to DB immediately so it shows in sidebar
                    await HistoryService.ensureSessionExists(userId, actualSessionId, initialTitle, modelId || undefined);

                    const { AgentWorkflow } = await import('../workflows/AgentWorkflow');

                    // Generate traceId and return immediately
                    const traceId = crypto.randomUUID();

                    // Return traceId and sessionId to client immediately
                    res.json({ traceId, sessionId: actualSessionId });

                    // Build API Key context if applicable
                    const apiKeyContext = req.user.isApiKey ? {
                        isApiKey: true,
                        allowedDepartments: req.user.allowedDepartments || [],
                        allowedKnowledgeIds: req.user.allowedKnowledgeIds || [],
                        allowedTools: req.user.allowedTools || ['*'],
                    } : undefined;

                    // Block model-mode keys from agent endpoint
                    if (req.user.isApiKey && req.user.apiKeyMode === 'model') {
                        return res.status(403).json({
                            error: 'This API Key is in "model" mode. Use POST /api/chat/completions instead.',
                            endpoint: '/api/chat/completions'
                        });
                    }

                    // Start workflow in background (fire-and-forget)
                    AgentWorkflow.execute({
                        userId,
                        sessionId: actualSessionId,
                        message,
                        userRole: req.user.role,
                        userDepartment: req.user.department,
                        collectionId,
                        images,
                        files,
                        traceId,
                        modelId: modelId || undefined,
                        apiKeyContext
                    }).catch((err: any) => {
                        LoggerService.error('agent_workflow_error', { error: err.message, stack: err.stack });
                    });
                } catch (err: any) {
                    LoggerService.error('agent_workflow_init_error', { error: err.message });
                    if (!res.headersSent) res.status(500).json({ error: 'Agent Error' });
                }
            });
        };

        if (isMultipart) {
            const bb = busboy({
                headers: req.headers,
                limits: {
                    fieldSize: 10 * 1024 * 1024,
                    fileSize: MAX_CHAT_FILE_SIZE,
                    files: MAX_CHAT_FILES,
                    parts: MAX_CHAT_FILES + 50,
                }
            });
            const filePromises: Promise<any>[] = [];

            bb.on('field', (name: string, val: string) => {
                if (name === 'message') message = val;
                if (name === 'sessionId') sessionId = val;
                if (name === 'modelId') modelId = val;
                if (name === 'collectionId') collectionId = val;
                if (name === 'context') context = val;
                if (name === 'scenarioId') scenarioId = val;
                if (name === 'mode') mode = val as any;
                if (name === 'images') { try { images = ChatController.transformImages(JSON.parse(val)); } catch (e) { } }
            });

            // @ts-ignore
            bb.on('file', (name: string, file: any, info: any) => {
                if (rejected) {
                    file.resume();
                    return;
                }

                const decodedName = Buffer.from(info.filename, 'latin1').toString('utf8');
                const ext = decodedName.split('.').pop()?.toLowerCase() || '';

                if (!ALLOWED_EXTENSIONS.has(ext)) {
                    rejected = respondOnce(400, `File extension ".${ext}" is not allowed.`);
                    LoggerService.warn('chat_upload_blocked_extension', { fileName: decodedName, ext, userId });
                    file.resume();
                    return;
                }

                fileCount += 1;
                if (fileCount > MAX_CHAT_FILES) {
                    rejected = respondOnce(413, `Too many files. Maximum ${MAX_CHAT_FILES} per request.`);
                    LoggerService.warn('chat_upload_too_many_files', { fileName: decodedName, max: MAX_CHAT_FILES, userId });
                    file.resume();
                    return;
                }

                LoggerService.debug('chat_busboy_file_event', { fieldName: name, filename: decodedName, mimeType: info.mimeType });
                const mimeType = info.mimeType || info.mime;
                const promise = new Promise<any>((resolve) => {
                    const chunks: Buffer[] = [];
                    let firstChunkValidated = false;
                    let blocked = false;

                    file.on('data', (chunk: Buffer) => {
                        if (blocked || rejected) return;

                        // Validate magic bytes on first chunk
                        if (!firstChunkValidated) {
                            firstChunkValidated = true;
                            const validation = validateFileBuffer(chunk, decodedName, mimeType);
                            if (!validation.valid) {
                                blocked = true;
                                rejected = respondOnce(400, validation.reason || 'Invalid file');
                                LoggerService.error('chat_upload_blocked_magic_bytes', { fileName: decodedName, reason: validation.reason, userId });
                                file.resume();
                                return;
                            }
                        }

                        totalFileBytes += chunk.length;
                        if (totalFileBytes > MAX_CHAT_TOTAL_SIZE) {
                            blocked = true;
                            rejected = respondOnce(413, `Total attachments exceed ${(MAX_CHAT_TOTAL_SIZE / (1024 * 1024)).toFixed(0)} MB.`);
                            LoggerService.warn('chat_upload_total_size_exceeded', { totalBytes: totalFileBytes, limit: MAX_CHAT_TOTAL_SIZE, userId });
                            file.resume();
                            return;
                        }

                        chunks.push(chunk);
                    });

                    file.on('limit', () => {
                        blocked = true;
                        rejected = respondOnce(413, `File "${decodedName}" exceeds ${(MAX_CHAT_FILE_SIZE / (1024 * 1024)).toFixed(0)} MB limit.`);
                        LoggerService.error('chat_upload_file_size_exceeded', { fileName: decodedName, limit: MAX_CHAT_FILE_SIZE, userId });
                        file.resume();
                    });

                    file.on('end', () => {
                        if (blocked || rejected) {
                            resolve(null);
                            return;
                        }
                        const buf = Buffer.concat(chunks);
                        resolve({
                            name: decodedName,
                            mediaType: mimeType,
                            size: buf.length,
                            buffer: buf,
                            originalname: decodedName
                        });
                    });
                });
                filePromises.push(promise);
            });

            bb.on('close', async () => {
                if (rejected) return;
                const results = await Promise.all(filePromises);
                results.forEach(f => {
                    if (f) files.push(f);
                });
                LoggerService.debug('chat_busboy_close', { fileCount: files.length, fileDetails: files.map(f => ({ name: f.name, size: f.size, hasBuffer: !!f.buffer })) });
                executeAgent(); // Always use Agent
            });

            req.pipe(bb);
        } else {
            // JSON body — file uploads are NOT supported via this path
            message = req.body.message;
            sessionId = req.body.sessionId;
            modelId = req.body.modelId;
            collectionId = req.body.collectionId;
            context = req.body.context;
            scenarioId = req.body.scenarioId;
            mode = req.body.mode || 'chat';
            images = ChatController.transformImages(req.body.images);
            // Files via JSON body lack Buffer data — warn if present
            if (req.body.files?.length) {
                LoggerService.warn('chat_json_body_files', { message: 'Files sent via JSON body will not have buffer data. Use multipart/form-data for file uploads.' });
            }

            executeAgent();
        }
    }

    private static transformImages(images: any[]): any[] {
        if (!images || !Array.isArray(images)) return [];
        return images.map((img: any) => {
            // Already in Bedrock format?
            if (img.source && img.format) return img;

            // Frontend format: { data: "base64", mediaType: "image/png" }
            if (img.data && img.mediaType) {
                return {
                    format: img.mediaType.replace('image/', ''),
                    source: {
                        bytes: img.data
                    }
                };
            }
            return img;
        });
    }

    static async getModels(req: any, res: Response) {
        try {
            const data = await BedrockService.getModels();
            res.json(data);
        } catch (error: any) {
            LoggerService.error('chat_get_models_error', {
                message: error.message,
                responseData: error.response?.data,
                responseStatus: error.response?.status
            });
            res.status(500).json({
                error: 'Failed to fetch available models',
                details: error.message,
                status: error.response?.status
            });
        }
    }

    static async getHistory(req: any, res: Response) {
        const { sessionId } = req.params;
        const userId = req.user.userId;
        const limit = parseInt(req.query.limit as string) || 20;
        const before = req.query.before as string;

        try {
            const messages = await HistoryService.getHistoryWithPagination(userId, sessionId, limit, before);
            res.json({ sessionId, messages, source: 'unified' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to retrieve history' });
        }
    }

    static async listSessions(req: any, res: Response) {
        const userId = req.user.userId;
        const limit = parseInt(req.query.limit as string) || 20;

        try {
            const conversations = await Conversation.find({ userId, isDeleted: { $ne: true } })
                .select('sessionId metadata createdAt updatedAt')
                .sort({ updatedAt: -1 })
                .limit(limit);

            res.json({ conversations });
        } catch (error) {
            res.status(500).json({ error: 'Failed to retrieve sessions' });
        }
    }

    static async clearSession(req: any, res: Response) {
        const { sessionId } = req.params;
        const userId = req.user.userId;
        try {
            await HistoryService.clearSession(userId, sessionId);
            LoggerService.log('info', 'session_cleared', { sessionId }, userId);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: 'Failed to clear session' });
        }
    }
    static async downloadAttachment(req: any, res: Response) {
        const key = req.params[0]; // wildcard used in route
        const userId = req.user.userId;

        if (!key) return res.status(400).json({ error: 'Key required' });

        // Security check: key ownership + path traversal protection
        if (!ChatAttachmentService.validateKeyOwnership(key, userId)) {
            LoggerService.warn('attachment_access_denied', { userId, key });
            return res.status(403).json({ error: 'Access denied' });
        }

        try {
            await ChatAttachmentService.streamAttachment(key, res, userId);
        } catch (error: any) {
            LoggerService.error('attachment_download_failed', { key, error: error.message }, userId);
            if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
        }
    }

    /**
     * POST /api/chat/feedback — Save like/dislike on a message
     */
    static async submitFeedback(req: any, res: Response) {
        const userId = req.user?.userId;
        if (!userId) return res.status(401).json({ error: 'Unauthorized' });

        const { sessionId, messageIndex, type, knowledgeIds, query } = req.body;

        if (!sessionId || messageIndex === undefined || !type) {
            return res.status(400).json({ error: 'sessionId, messageIndex, and type are required' });
        }
        if (!['liked', 'disliked'].includes(type)) {
            return res.status(400).json({ error: 'type must be "liked" or "disliked"' });
        }

        try {
            const { MessageFeedback } = await import('../models/MessageFeedback');

            // Upsert: one feedback per user per message (unique index handles conflicts)
            await MessageFeedback.findOneAndUpdate(
                { sessionId, messageIndex, userId },
                {
                    $set: {
                        type,
                        knowledgeIds: knowledgeIds || [],
                        query: query || ''
                    }
                },
                { upsert: true, new: true }
            );

            res.json({ success: true });
        } catch (error: any) {
            LoggerService.error('feedback_save_failed', { error: error.message }, userId);
            res.status(500).json({ error: 'Failed to save feedback' });
        }
    }

    // ── GDPR Compliance Endpoints ────────────────────────────

    /**
     * GET /api/chat/export — Export all user's chat data (GDPR Article 20).
     */
    static async exportData(req: any, res: Response) {
        const userId = req.user.userId;
        try {
            const data = await HistoryService.exportUserData(userId);
            res.setHeader('Content-Disposition', `attachment; filename="chat-export-${userId}-${Date.now()}.json"`);
            res.setHeader('Content-Type', 'application/json');
            res.json({
                exportedAt: new Date().toISOString(),
                userId,
                conversationCount: data.length,
                conversations: data
            });
        } catch (error: any) {
            LoggerService.error('gdpr_export_failed', { error: error.message }, userId);
            res.status(500).json({ error: 'Failed to export data' });
        }
    }

    /**
     * DELETE /api/chat/purge — Hard-delete ALL user data (GDPR Article 17).
     * Requires confirmation header: X-Confirm-Purge: DELETE-ALL-MY-DATA
     */
    static async purgeData(req: any, res: Response) {
        const userId = req.user.userId;
        const confirmation = req.headers['x-confirm-purge'];

        if (confirmation !== 'DELETE-ALL-MY-DATA') {
            return res.status(400).json({
                error: 'Purge requires confirmation header: X-Confirm-Purge: DELETE-ALL-MY-DATA'
            });
        }

        try {
            const result = await HistoryService.purgeUserData(userId);
            LoggerService.log('info', 'gdpr_data_purged', { ...result }, userId);
            res.json({ success: true, ...result });
        } catch (error: any) {
            LoggerService.error('gdpr_purge_failed', { error: error.message }, userId);
            res.status(500).json({ error: 'Failed to purge data' });
        }
    }

    // ── Search ─────────────────────────────────────────────

    /**
     * GET /api/chat/search?q=keyword&limit=20 — Search chat history.
     */
    static async searchHistory(req: any, res: Response) {
        const userId = req.user.userId;
        const query = req.query.q as string;
        const limit = parseInt(req.query.limit as string) || 20;

        if (!query || query.trim().length < 2) {
            return res.status(400).json({ error: 'Search query must be at least 2 characters' });
        }

        try {
            const results = await HistoryService.searchHistory(userId, query.trim(), Math.min(limit, 50));
            res.json({ query, resultCount: results.length, results });
        } catch (error: any) {
            LoggerService.error('search_history_failed', { error: error.message }, userId);
            res.status(500).json({ error: 'Search failed' });
        }
    }
}
