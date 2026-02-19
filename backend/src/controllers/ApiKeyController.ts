import { Request, Response } from 'express';
import ApiKey from '../models/ApiKey';
import crypto from 'crypto';
import User from '../models/User';

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
     * Create a new API Key for the current user
     */
    static async createApiKey(req: Request, res: Response) {
        try {
            // @ts-ignore
            const userId = req.user?.userId;
            const { name, scopes } = req.body;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            if (!name) {
                return res.status(400).json({ error: 'Name is required' });
            }

            // Generate Key
            const prefix = 'sk_live_';
            const secret = crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); // simplified base64url
            const rawKey = `${prefix}${secret}`;

            // Hash Key
            const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

            const apiKey = new ApiKey({
                user: userId,
                keyHash,
                keyPrefix: prefix,
                name,
                scopes: scopes || [], // e.g. ["chat:read", "chat:write"]
                expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined
            });

            await apiKey.save();

            // Return raw key ONCE
            res.status(201).json({
                _id: apiKey._id,
                name: apiKey.name,
                createdAt: apiKey.createdAt,
                key: rawKey,
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
