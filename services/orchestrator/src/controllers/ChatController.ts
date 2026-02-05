import { Request, Response } from 'express';
import busboy from 'busboy';
import { ChatWorkflow } from '../workflows/ChatWorkflow';
import { KnowledgeService } from '../services/KnowledgeService';
import { HistoryService } from '../services/HistoryService';
import { BedrockService } from '../services/BedrockService';
import { Conversation } from '../models/Conversation';
import { LoggerService } from '../services/LoggerService';
import { CanonicalIR } from '../../../../shared/types';

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
        let fileParses: CanonicalIR[] = [];

        const executeWorkflow = () => {
            // Fallback for empty sessionId
            const actualSessionId = sessionId || `session-${Date.now()}`;

            if (!message && (!images || images.length === 0) && (!files || files.length === 0)) {
                return res.status(400).json({ error: 'Message or attachment is required' });
            }

            ChatWorkflow.execute({
                userId,
                sessionId: actualSessionId,
                message,
                modelId,
                collectionId,
                context,
                scenarioId,
                images,
                files,
                userRole: req.user.role,
                userDepartment: req.user.department
            }, res, fileParses).catch(err => {
                console.error('[ChatController] Workflow Error:', err);
                if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
            });
        };

        if (isMultipart) {
            const bb = busboy({ headers: req.headers });
            const filePromises: Promise<void>[] = [];

            bb.on('field', (name: string, val: string) => {
                if (name === 'message') message = val;
                if (name === 'sessionId') sessionId = val;
                if (name === 'modelId') modelId = val;
                if (name === 'collectionId') collectionId = val;
                if (name === 'context') context = val;
                if (name === 'scenarioId') scenarioId = val;
                if (name === 'images') { try { images = JSON.parse(val); } catch (e) { } }
            });

            // @ts-ignore
            bb.on('file', (name: string, file: any, info: any) => {
                // Determine mimeType - busboy info object has it.
                // Depending on newer busboy versions, it might be info.mimeType or info.mime
                const mimeType = info.mimeType || info.mime;

                const promise = new Promise<void>(async (resolve) => {
                    const chunks: any[] = [];
                    file.on('data', (d: any) => chunks.push(d));
                    file.on('end', async () => {
                        const buf = Buffer.concat(chunks);
                        files.push({
                            name: info.filename,
                            mediaType: mimeType,
                            size: buf.length
                        });

                        const ir = await KnowledgeService.parseFile(buf, info.filename, mimeType);
                        if (ir) fileParses.push(ir);

                        resolve();
                    });
                });
                filePromises.push(promise);
            });

            bb.on('close', async () => {
                await Promise.all(filePromises);
                executeWorkflow();
            });

            req.pipe(bb);
        } else {
            message = req.body.message;
            sessionId = req.body.sessionId;
            modelId = req.body.modelId;
            collectionId = req.body.collectionId;
            context = req.body.context;
            images = req.body.images;
            files = req.body.files;
            scenarioId = req.body.scenarioId;
            executeWorkflow();
        }
    }

    static async getModels(req: any, res: Response) {
        try {
            const data = await BedrockService.getModels();
            res.json(data);
        } catch (error: any) {
            res.status(500).json({ error: 'Failed to fetch available models' });
        }
    }

    static async getHistory(req: any, res: Response) {
        const { sessionId } = req.params;
        const userId = req.user.userId;

        try {
            const messages = await HistoryService.getHistory(userId, sessionId);
            // If from Redis/Cache, we might not get full metadata or source flag easily unless we check where it came from
            // But HistoryService abstracts that.
            // Server.ts returned { sessionId, messages, source: 'cache'/'database' }.
            // For now, let's just return messages.
            res.json({ sessionId, messages, source: 'unified' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to retrieve history' });
        }
    }

    static async listSessions(req: any, res: Response) {
        const userId = req.user.userId;
        const limit = parseInt(req.query.limit as string) || 20;

        try {
            const conversations = await Conversation.find({ userId })
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
}
