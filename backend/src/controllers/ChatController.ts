import { Request, Response } from 'express';
import busboy from 'busboy';
import { KnowledgeService } from '../services/KnowledgeService';
import { HistoryService } from '../services/HistoryService';
import { BedrockService } from '../services/BedrockService';
import { Conversation } from '../models/Conversation';
import { LoggerService } from '../services/LoggerService';
import { ContextService } from '../services/ContextService';
import { ChatAttachmentService } from '../services/ChatAttachmentService';

export class ChatController {
    static async chat(req: any, res: Response) {
        const isMultipart = req.headers['content-type']?.includes('multipart/form-data');
        const userId = req.user.userId;

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

        const executeAgent = () => {
            ContextService.run({ correlationId }, async () => {
                const actualSessionId = sessionId || `session-${Date.now()}`;
                if (!message && (!images || images.length === 0) && (!files || files.length === 0)) {
                    return res.status(400).json({ error: 'Message or attachment is required' });
                }

                try {
                    const { AgentWorkflow } = await import('../workflows/AgentWorkflow');

                    // Generate traceId and return immediately
                    const traceId = (global as any).crypto
                        ? (global as any).crypto.randomUUID()
                        : require('crypto').randomUUID();

                    // Return traceId to client immediately (JSON, not SSE)
                    res.json({ traceId, sessionId: actualSessionId });

                    // Start workflow in background (fire-and-forget)
                    AgentWorkflow.execute(
                        userId,
                        actualSessionId,
                        message,
                        req.user.role,
                        req.user.department,
                        collectionId,
                        images,
                        files,
                        traceId // Pass the traceId we just sent to client
                    ).catch((err: any) => {
                        LoggerService.error('agent_workflow_error', { error: err.message, stack: err.stack });
                    });
                } catch (err: any) {
                    LoggerService.error('agent_workflow_init_error', { error: err.message });
                    if (!res.headersSent) res.status(500).json({ error: 'Agent Error' });
                }
            });
        };

        if (isMultipart) {
            const bb = busboy({ headers: req.headers, limits: { fieldSize: 10 * 1024 * 1024 } });
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
                console.log(`[ChatController] busboy FILE event: fieldName="${name}", filename="${info.filename}", mimeType="${info.mimeType}"`);
                const mimeType = info.mimeType || info.mime;
                const promise = new Promise<any>(async (resolve) => {
                    const chunks: any[] = [];
                    file.on('data', (d: any) => chunks.push(d));
                    file.on('end', async () => {
                        const buf = Buffer.concat(chunks);
                        // Keep raw buffer — AgentWorkflow sends it as native doc block to Converse API
                        resolve({
                            name: info.filename,
                            mediaType: mimeType,
                            size: buf.length,
                            buffer: buf,
                            originalname: info.filename
                        });
                    });
                });
                filePromises.push(promise);
            });

            bb.on('close', async () => {
                const results = await Promise.all(filePromises);
                results.forEach(f => {
                    if (f) files.push(f);
                });
                console.log(`[ChatController] busboy CLOSE: files=${files.length}, filePromises=${filePromises.length}, fileDetails=${JSON.stringify(files.map(f => ({ name: f.name, size: f.size, hasBuffer: !!f.buffer })))}`);
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
                console.warn('[ChatController] Files sent via JSON body will not have buffer data. Use multipart/form-data for file uploads.');
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
            console.error('[ChatController] getModels Error:', error.message);
            if (error.response) {
                console.error('[ChatController] getModels Error Data:', error.response.data);
                console.error('[ChatController] getModels Error Status:', error.response.status);
            }
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

        // Security check: Key ownership
        if (!key.startsWith(`${userId}/`)) {
            console.warn(`[ChatController] Access Denied: User ${userId} tried to access ${key}`);
            return res.status(403).json({ error: 'Access denied' });
        }

        console.log(`[ChatController] Downloading attachment: ${key} for user ${userId}`);

        try {
            await ChatAttachmentService.streamAttachment(key, res, userId, req.user.role || 'student');
        } catch (error: any) {
            console.error('Download Error:', error.message);
            if (!res.headersSent) res.status(500).json({ error: 'Download failed' });
        }
    }
}
