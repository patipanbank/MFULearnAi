import { Request, Response } from 'express';
import ApiKey from '../models/ApiKey';
import crypto from 'crypto';
import User from '../models/User';
import { AVAILABLE_MODELS } from '../config/models';

export class ApiKeyController {
    /**
     * List all API keys for the current user
     */
    static async listApiKeys(req: Request, res: Response) {
        try {
            // @ts-ignore
            const userId = req.user?.userId;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const keys = await ApiKey.find({ user: userId })
                .select('-keyHash') // Hide hash
                .sort({ createdAt: -1 });

            res.json(keys);
        } catch (error) {
            console.error('List API Keys Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    /**
     * Return available models for key creation UI
     */
    static async listModels(_req: Request, res: Response) {
        res.json(AVAILABLE_MODELS.map(m => ({ id: m.id, name: m.name, type: m.type })));
    }

    /**
     * Create a new API Key for the current user
     */
    static async createApiKey(req: Request, res: Response) {
        try {
            // @ts-ignore
            const userId = req.user?.userId;
            const {
                name,
                scopes,
                mode,
                allowedDepartments,
                allowedKnowledgeIds,
                allowedTools,
                modelId,
            } = req.body;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            const keyMode = mode || 'agent';
            if (!['agent', 'model'].includes(keyMode)) {
                return res.status(400).json({ error: 'mode must be "agent" or "model"' });
            }

            // Validate modelId for model mode
            if (keyMode === 'model') {
                if (!modelId) {
                    return res.status(400).json({ error: 'modelId is required for model mode' });
                }
                const valid = AVAILABLE_MODELS.some(m => m.id === modelId);
                if (!valid) {
                    return res.status(400).json({
                        error: 'Invalid modelId',
                        availableModels: AVAILABLE_MODELS.map(m => ({ id: m.id, name: m.name }))
                    });
                }
            }

            // Generate Key
            const prefix = keyMode === 'agent' ? 'sk_agent_' : 'sk_model_';
            const secret = crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
            const rawKey = `${prefix}${secret}`;

            // Hash Key
            const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

            const apiKey = new ApiKey({
                user: userId,
                keyHash,
                keyPrefix: prefix,
                name,
                scopes: scopes || [],
                mode: keyMode,

                // Agent mode settings
                allowedDepartments: keyMode === 'agent' ? (allowedDepartments || []) : [],
                allowedKnowledgeIds: keyMode === 'agent' ? (allowedKnowledgeIds || []) : [],
                allowedTools: keyMode === 'agent' ? (allowedTools || ['*']) : [],

                // Model mode settings
                modelId: keyMode === 'model' ? modelId : undefined,

                expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined
            });

            await apiKey.save();

            // Build usage guide
            const usageGuide = keyMode === 'model'
                ? {
                    endpoint: 'POST /api/chat/completions',
                    headers: { 'Authorization': `Bearer ${rawKey}`, 'Content-Type': 'application/json' },
                    body: { message: 'สวัสดี ช่วยอธิบายเรื่อง AI ให้หน่อย' },
                    response: { message: '(AI response text)', model: modelId, usage: { input: 0, output: 0, total: 0 } }
                }
                : {
                    endpoint: 'POST /api/chat',
                    headers: { 'Authorization': `Bearer ${rawKey}`, 'Content-Type': 'application/json' },
                    body: { message: 'สวัสดี', collectionId: '(optional)' },
                    response: { traceId: '(uuid)', sessionId: '(uuid)', note: 'Connect via Socket.IO with traceId to receive streaming response' }
                };

            // Return raw key ONCE
            res.status(201).json({
                _id: apiKey._id,
                name: apiKey.name,
                mode: keyMode,
                createdAt: apiKey.createdAt,
                key: rawKey,
                usage: usageGuide,
                message: "Save this key now. It won't be shown again."
            });
        } catch (error) {
            console.error('Create API Key Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    /**
     * Revoke (Delete/Disable) an API Key
     */
    static async revokeApiKey(req: Request, res: Response) {
        try {
            // @ts-ignore
            const userId = req.user?.userId;
            const { id } = req.params;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const apiKey = await ApiKey.findOne({ _id: id, user: userId });
            if (!apiKey) {
                return res.status(404).json({ error: 'API Key not found' });
            }

            apiKey.revokedAt = new Date();
            await apiKey.save();

            res.json({ message: 'API Key revoked successfully' });
        } catch (error) {
            console.error('Revoke API Key Error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
}
