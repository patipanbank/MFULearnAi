/**
 * Enhanced API Key Controller — Full CRUD + rotation + analytics + admin
 *
 * Endpoints mounted under /v1/api-keys/*
 * Provides OpenRouter-level key management for external consumers.
 */

import { Request, Response } from 'express';
import ApiKey from '../models/ApiKey';
import crypto from 'crypto';
import { AVAILABLE_MODELS } from '../config/models';
import { ApiKeyUsageService } from '../services/ApiKeyUsageService';
import { getAvailableModelsOpenAI, resolveModelId, getOpenAIModelName } from '../openai/modelMapping';

export class EnhancedApiKeyController {

    // ═══════════════════════════════════════════════════════════
    // CRUD Operations
    // ═══════════════════════════════════════════════════════════

    /**
     * GET /v1/api-keys — List all keys for current user.
     */
    static async listApiKeys(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;
            if (!userId) return res.status(401).json({ error: { message: 'Unauthorized', type: 'authentication_error' } });

            const { organization, project, tag, mode } = req.query;

            const filter: any = { user: userId };
            if (organization) filter.organization = organization;
            if (project) filter.project = project;
            if (tag) filter.tags = tag;
            if (mode) filter.mode = mode;

            const keys = await ApiKey.find(filter)
                .select('-keyHash -previousKeyHashes')
                .sort({ createdAt: -1 })
                .lean();

            res.json({
                object: 'list',
                data: keys.map(k => ({
                    ...k,
                    // Add OpenAI-style model names
                    modelAlias: k.modelId ? getOpenAIModelName(k.modelId) : undefined,
                })),
            });
        } catch (error: any) {
            res.status(500).json({ error: { message: error.message, type: 'server_error' } });
        }
    }

    /**
     * POST /v1/api-keys — Create a new API key.
     */
    static async createApiKey(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;
            if (!userId) return res.status(401).json({ error: { message: 'Unauthorized', type: 'authentication_error' } });

            const {
                name, description, mode, scopes,
                organization, project, tags,
                // Agent mode
                allowedDepartments, allowedKnowledgeIds, allowedTools,
                // Model mode
                modelId, allowedModels, fallbackModelId,
                // Limits
                rateLimit, monthlyBudget, dailyTokenLimit,
                // Security
                allowedIPs, expiresAt,
            } = req.body;

            if (!name) {
                return res.status(400).json({ error: { message: "'name' is required.", type: 'invalid_request_error' } });
            }

            const keyMode = mode || 'model';
            if (!['agent', 'model'].includes(keyMode)) {
                return res.status(400).json({ error: { message: "mode must be 'agent' or 'model'.", type: 'invalid_request_error' } });
            }

            // Validate model(s) for model mode
            let resolvedModelId: string | undefined;
            let resolvedAllowedModels: string[] = [];
            let resolvedFallback: string | undefined;

            if (keyMode === 'model') {
                if (modelId) {
                    const resolved = resolveModelId(modelId);
                    if (!resolved) {
                        return res.status(400).json({
                            error: { message: `Model '${modelId}' not found. Use GET /v1/models for available models.`, type: 'invalid_request_error' },
                        });
                    }
                    resolvedModelId = resolved;
                }

                if (allowedModels && Array.isArray(allowedModels)) {
                    for (const m of allowedModels) {
                        if (m === '*') { resolvedAllowedModels = ['*']; break; }
                        const resolved = resolveModelId(m);
                        if (!resolved) {
                            return res.status(400).json({
                                error: { message: `Allowed model '${m}' not found.`, type: 'invalid_request_error' },
                            });
                        }
                        resolvedAllowedModels.push(resolved);
                    }
                }

                if (fallbackModelId) {
                    resolvedFallback = resolveModelId(fallbackModelId) || undefined;
                }
            }

            // ── Generate Key ──
            const prefix = keyMode === 'agent' ? 'sk_agent_' : 'sk_model_';
            const secret = crypto.randomBytes(32).toString('base64url');
            const rawKey = `${prefix}${secret}`;
            const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

            const apiKey = new ApiKey({
                user: userId,
                keyHash,
                keyPrefix: prefix,
                name,
                description: description || '',
                scopes: scopes || [],
                mode: keyMode,

                // Org & project
                organization: organization || '',
                project: project || '',
                tags: tags || [],

                // Agent mode
                allowedDepartments: keyMode === 'agent' ? (allowedDepartments || []) : [],
                allowedKnowledgeIds: keyMode === 'agent' ? (allowedKnowledgeIds || []) : [],
                allowedTools: keyMode === 'agent' ? (allowedTools || ['*']) : [],

                // Model mode
                modelId: resolvedModelId,
                allowedModels: resolvedAllowedModels,
                fallbackModelId: resolvedFallback,

                // Limits
                rateLimit: {
                    requestsPerHour: rateLimit?.requestsPerHour || 1000,
                    requestsPerMinute: rateLimit?.requestsPerMinute || 60,
                    tokensPerDay: rateLimit?.tokensPerDay || 0,
                    tokensPerMonth: rateLimit?.tokensPerMonth || 0,
                },
                monthlyBudget: monthlyBudget || 0,
                dailyTokenLimit: dailyTokenLimit || 0,

                // Security
                allowedIPs: allowedIPs || [],
                expiresAt: expiresAt ? new Date(expiresAt) : undefined,
            });

            await apiKey.save();

            // Build OpenAI-compatible usage guide
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const usageGuide = {
                base_url: `${baseUrl}/v1`,
                endpoints: {
                    chat: 'POST /v1/chat/completions',
                    models: 'GET /v1/models',
                    embeddings: 'POST /v1/embeddings',
                },
                python_example: `from openai import OpenAI\n\nclient = OpenAI(\n    api_key="${rawKey}",\n    base_url="${baseUrl}/v1"\n)\n\nresponse = client.chat.completions.create(\n    model="${resolvedModelId ? getOpenAIModelName(resolvedModelId) : 'claude-3.5-sonnet'}",\n    messages=[{"role": "user", "content": "Hello!"}]\n)`,
                javascript_example: `import OpenAI from 'openai';\n\nconst client = new OpenAI({\n    apiKey: '${rawKey}',\n    baseURL: '${baseUrl}/v1'\n});\n\nconst response = await client.chat.completions.create({\n    model: '${resolvedModelId ? getOpenAIModelName(resolvedModelId) : 'claude-3.5-sonnet'}',\n    messages: [{ role: 'user', content: 'Hello!' }]\n});`,
                curl_example: `curl ${baseUrl}/v1/chat/completions \\\n  -H "Authorization: Bearer ${rawKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "${resolvedModelId ? getOpenAIModelName(resolvedModelId) : 'claude-3.5-sonnet'}", "messages": [{"role": "user", "content": "Hello!"}]}'`,
            };

            res.status(201).json({
                id: apiKey._id,
                name: apiKey.name,
                mode: keyMode,
                organization: apiKey.organization,
                project: apiKey.project,
                model: resolvedModelId ? getOpenAIModelName(resolvedModelId) : undefined,
                createdAt: apiKey.createdAt,
                key: rawKey,
                usage_guide: usageGuide,
                message: "⚠️ Save this key now — it will not be shown again.",
            });
        } catch (error: any) {
            res.status(500).json({ error: { message: error.message, type: 'server_error' } });
        }
    }

    /**
     * PUT /v1/api-keys/:id — Update an existing key (name, limits, allowed models, etc.)
     */
    static async updateApiKey(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;
            const { id } = req.params;
            if (!userId) return res.status(401).json({ error: { message: 'Unauthorized', type: 'authentication_error' } });

            const apiKey = await ApiKey.findOne({ _id: id, user: userId });
            if (!apiKey) return res.status(404).json({ error: { message: 'API key not found.', type: 'invalid_request_error' } });
            if (apiKey.revokedAt) return res.status(400).json({ error: { message: 'Cannot update a revoked key.', type: 'invalid_request_error' } });

            const updatable = [
                'name', 'description', 'organization', 'project', 'tags',
                'allowedDepartments', 'allowedKnowledgeIds', 'allowedTools',
                'allowedModels', 'fallbackModelId',
                'rateLimit', 'monthlyBudget', 'dailyTokenLimit',
                'allowedIPs', 'expiresAt', 'scopes',
            ];

            const update: any = {};
            for (const field of updatable) {
                if (req.body[field] !== undefined) {
                    if (field === 'expiresAt') {
                        update[field] = req.body[field] ? new Date(req.body[field]) : undefined;
                    } else if (field === 'fallbackModelId') {
                        update[field] = resolveModelId(req.body[field]) || undefined;
                    } else if (field === 'allowedModels' && Array.isArray(req.body[field])) {
                        update[field] = req.body[field].map((m: string) => {
                            if (m === '*') return '*';
                            return resolveModelId(m) || m;
                        });
                    } else {
                        update[field] = req.body[field];
                    }
                }
            }

            await ApiKey.updateOne({ _id: id }, { $set: update });

            const updated = await ApiKey.findById(id).select('-keyHash -previousKeyHashes').lean();
            res.json(updated);
        } catch (error: any) {
            res.status(500).json({ error: { message: error.message, type: 'server_error' } });
        }
    }

    /**
     * DELETE /v1/api-keys/:id — Revoke a key (soft delete).
     */
    static async revokeApiKey(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;
            const { id } = req.params;
            if (!userId) return res.status(401).json({ error: { message: 'Unauthorized', type: 'authentication_error' } });

            const apiKey = await ApiKey.findOne({ _id: id, user: userId });
            if (!apiKey) return res.status(404).json({ error: { message: 'API key not found.', type: 'invalid_request_error' } });

            apiKey.revokedAt = new Date();
            await apiKey.save();

            res.json({ id: apiKey._id, revoked: true, message: 'API key revoked successfully.' });
        } catch (error: any) {
            res.status(500).json({ error: { message: error.message, type: 'server_error' } });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Key Rotation
    // ═══════════════════════════════════════════════════════════

    /**
     * POST /v1/api-keys/:id/rotate — Rotate key with grace period.
     * Old key remains valid for `gracePeriodHours` (default 24h).
     */
    static async rotateApiKey(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;
            const { id } = req.params;
            const { gracePeriodHours = 24 } = req.body;

            if (!userId) return res.status(401).json({ error: { message: 'Unauthorized', type: 'authentication_error' } });

            const apiKey = await ApiKey.findOne({ _id: id, user: userId });
            if (!apiKey) return res.status(404).json({ error: { message: 'API key not found.', type: 'invalid_request_error' } });
            if (apiKey.revokedAt) return res.status(400).json({ error: { message: 'Cannot rotate a revoked key.', type: 'invalid_request_error' } });

            // Move current hash to previousKeyHashes
            const rotatedAt = new Date();
            const graceExpiresAt = new Date(rotatedAt.getTime() + gracePeriodHours * 60 * 60 * 1000);

            // Clean up expired previous hashes
            apiKey.previousKeyHashes = (apiKey.previousKeyHashes || []).filter(
                p => p.expiresAt > rotatedAt
            );

            // Add current key to previous
            apiKey.previousKeyHashes.push({
                hash: apiKey.keyHash,
                rotatedAt,
                expiresAt: graceExpiresAt,
            });

            // Generate new key
            const prefix = apiKey.keyPrefix;
            const secret = crypto.randomBytes(32).toString('base64url');
            const rawKey = `${prefix}${secret}`;
            const newKeyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

            apiKey.keyHash = newKeyHash;
            await apiKey.save();

            res.json({
                id: apiKey._id,
                key: rawKey,
                rotated: true,
                gracePeriod: {
                    hours: gracePeriodHours,
                    expiresAt: graceExpiresAt.toISOString(),
                },
                message: `⚠️ Save this new key. Old key remains valid until ${graceExpiresAt.toISOString()}.`,
            });
        } catch (error: any) {
            res.status(500).json({ error: { message: error.message, type: 'server_error' } });
        }
    }

    // ═══════════════════════════════════════════════════════════
    // Usage & Analytics
    // ═══════════════════════════════════════════════════════════

    /**
     * GET /v1/api-keys/:id/usage — Get usage analytics for a specific key.
     */
    static async getKeyUsage(req: Request, res: Response) {
        try {
            const userId = (req as any).user?.userId;
            const { id } = req.params;
            const days = parseInt(req.query.days as string) || 30;

            if (!userId) return res.status(401).json({ error: { message: 'Unauthorized', type: 'authentication_error' } });

            const apiKey = await ApiKey.findOne({ _id: id, user: userId });
            if (!apiKey) return res.status(404).json({ error: { message: 'API key not found.', type: 'invalid_request_error' } });

            const analytics = await ApiKeyUsageService.getKeyAnalytics(id, days);

            res.json({
                id,
                name: apiKey.name,
                ...analytics,
                limits: {
                    rateLimit: apiKey.rateLimit,
                    dailyTokenLimit: apiKey.dailyTokenLimit,
                    monthlyBudget: apiKey.monthlyBudget,
                },
                counters: {
                    totalRequests: apiKey.totalRequests,
                    totalTokens: apiKey.totalTokens,
                },
            });
        } catch (error: any) {
            res.status(500).json({ error: { message: error.message, type: 'server_error' } });
        }
    }

    /**
     * GET /v1/api-keys/usage/organization — Get org-level billing summary (admin).
     */
    static async getOrgUsage(req: Request, res: Response) {
        try {
            const { organization, month } = req.query;
            if (!organization) {
                return res.status(400).json({ error: { message: "'organization' query param is required.", type: 'invalid_request_error' } });
            }
            const result = await ApiKeyUsageService.getOrgUsage(organization as string, month as string);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: { message: error.message, type: 'server_error' } });
        }
    }

    /**
     * GET /v1/admin/usage/dashboard — Admin usage dashboard (superadmin only).
     */
    static async getAdminDashboard(req: Request, res: Response) {
        try {
            const days = parseInt(req.query.days as string) || 30;
            const result = await ApiKeyUsageService.getAdminDashboard(days);
            res.json(result);
        } catch (error: any) {
            res.status(500).json({ error: { message: error.message, type: 'server_error' } });
        }
    }

    /**
     * GET /v1/api-keys/models — List available models (for key creation).
     */
    static async listModels(_req: Request, res: Response) {
        const models = getAvailableModelsOpenAI();
        res.json({
            object: 'list',
            data: models,
        });
    }
}
