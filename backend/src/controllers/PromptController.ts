import { Request, Response } from 'express';
import Prompt, { IPrompt } from '../models/Prompt';
import { redis } from '../config/redis';
import { PromptService } from '../services/PromptService';

const SYSTEM_PROMPT_KEY_PREFIX = 'system_prompt:';

export class PromptController {
    static async listPrompts(req: any, res: Response) {
        const { type, isPublic, ownerId } = req.query;
        const userId = req.user.userId;

        try {
            const query: any = {};
            if (type) query.type = type;

            if (req.user.role === 'superadmin') {
                if (isPublic) query.isPublic = isPublic === 'true';
                if (ownerId) query.ownerId = ownerId;
            } else {
                query.$or = [{ isPublic: true }, { ownerId: userId }];
                if (ownerId === userId) {
                    delete query.$or;
                    query.ownerId = userId;
                }
            }

            const prompts = await Prompt.find(query).sort({ updatedAt: -1 });
            res.json({ prompts });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch prompts' });
        }
    }

    static async getPrompt(req: any, res: Response) {
        const { key } = req.params;
        const userId = req.user.userId;

        try {
            const prompt = await Prompt.findOne({ key });
            if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

            if (req.user.role !== 'superadmin' && !prompt.isPublic && prompt.ownerId !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            res.json({ prompt });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch prompt' });
        }
    }

    static async createPrompt(req: any, res: Response) {
        const { type, key, name, description, content, isPublic, tags } = req.body;
        const userId = req.user.userId;

        if (type === 'core' && req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Only superadmins can create core prompts' });
        }

        try {
            const newPrompt = new Prompt({
                key,
                type: type || 'scenario',
                ownerId: type === 'core' ? null : userId,
                name,
                description,
                isPublic: type === 'core' ? false : !!isPublic,
                tags: tags || [],
                activeVersion: 1,
                versions: [{
                    version: 1,
                    content: content || '',
                    changelog: 'Initial creation',
                    createdBy: userId,
                    createdAt: new Date()
                }]
            });

            await newPrompt.save();
            res.status(201).json({ prompt: newPrompt });
        } catch (error: any) {
            if (error.code === 11000) {
                return res.status(400).json({ error: 'Prompt key already exists' });
            }
            res.status(500).json({ error: 'Failed to create prompt' });
        }
    }

    static async addVersion(req: any, res: Response) {
        const { key } = req.params;
        const { content, changelog } = req.body;
        const userId = req.user.userId;

        try {
            const prompt = await Prompt.findOne({ key });
            if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

            if (req.user.role !== 'superadmin' && prompt.ownerId !== userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const newVersion = (prompt.activeVersion || 0) + 1;
            prompt.versions.push({
                version: newVersion,
                content,
                changelog: changelog || 'Updated version',
                createdBy: userId,
                createdAt: new Date()
            } as any);

            prompt.activeVersion = newVersion;
            prompt.updatedAt = new Date();
            await prompt.save();

            // Invalidate Cache
            if (prompt.type === 'core') {
                await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}CORE:PROD`);
                await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}CORE:TEST`);
            } else {
                await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}SCENARIO:${prompt._id}`);
            }

            res.json({ success: true, prompt });
        } catch (error) {
            res.status(500).json({ error: 'Failed to add version' });
        }
    }

    static async toggleActive(req: any, res: Response) {
        const { key } = req.params;
        const { isActive } = req.body;

        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Only superadmins can activate/deactivate prompts' });
        }

        try {
            const prompt = await Prompt.findOne({ key });
            if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

            const newState = typeof isActive === 'boolean' ? isActive : !prompt.isActive;

            if (newState === true && prompt.type === 'core') {
                const envTag = prompt.tags.find(t => ['PROD', 'TEST'].includes(t));
                if (envTag) {
                    await Prompt.updateMany(
                        { type: 'core', tags: envTag, _id: { $ne: prompt._id } },
                        { isActive: false }
                    );
                }
            }

            prompt.isActive = newState;
            await prompt.save();

            // Invalidate Cache
            await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}CORE:PROD`);
            await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}CORE:TEST`);

            res.json({ success: true, prompt });

        } catch (error) {
            res.status(500).json({ error: 'Failed to toggle status' });
        }
    }

    // ── New Dynamic Prompt Endpoints ──────────────────────────────

    /**
     * GET /api/prompts/meta/variables
     * Returns all available template variables for the admin UI.
     */
    static async getVariables(req: any, res: Response) {
        try {
            const variables = PromptService.getAvailableVariables();
            res.json({ variables });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get variables' });
        }
    }

    /**
     * POST /api/prompts/:key/preview
     * Renders a prompt with sample variable values for preview.
     * 
     * Body (optional): { overrides: { variableKey: "customValue" } }
     */
    static async previewPrompt(req: any, res: Response) {
        const { key } = req.params;
        const { overrides } = req.body || {};

        try {
            const prompt = await Prompt.findOne({ key });
            if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

            if (req.user.role !== 'superadmin' && !prompt.isPublic && prompt.ownerId !== req.user.userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Get the content of the active version
            const content = prompt.versions.find(v => v.version === prompt.activeVersion)?.content
                || prompt.versions[0]?.content
                || '';

            const rendered = PromptService.previewWithSampleValues(content, overrides);

            res.json({
                original: content,
                rendered,
                variables: PromptService.getAvailableVariables(),
                activeVersion: prompt.activeVersion
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to preview prompt' });
        }
    }

    /**
     * GET /api/prompts/:key/versions
     * Returns the version history for a specific prompt.
     */
    static async getVersionHistory(req: any, res: Response) {
        const { key } = req.params;

        try {
            const prompt = await Prompt.findOne({ key });
            if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

            if (req.user.role !== 'superadmin' && !prompt.isPublic && prompt.ownerId !== req.user.userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Return versions sorted by version number descending (newest first)
            const versions = [...prompt.versions].sort((a, b) => b.version - a.version);

            res.json({
                key: prompt.key,
                name: prompt.name,
                activeVersion: prompt.activeVersion,
                versions: versions.map(v => ({
                    version: v.version,
                    changelog: v.changelog,
                    createdBy: v.createdBy,
                    createdAt: v.createdAt,
                    contentLength: v.content?.length || 0,
                    isActive: v.version === prompt.activeVersion
                }))
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to get version history' });
        }
    }

    /**
     * POST /api/prompts/:key/rollback
     * Rollback to a specific version number.
     */
    static async rollbackVersion(req: any, res: Response) {
        const { key } = req.params;
        const { version } = req.body;

        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Only superadmins can rollback prompt versions' });
        }

        if (!version || typeof version !== 'number') {
            return res.status(400).json({ error: 'version (number) is required' });
        }

        try {
            const prompt = await Prompt.findOne({ key });
            if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

            const targetVersion = prompt.versions.find(v => v.version === version);
            if (!targetVersion) {
                return res.status(404).json({ error: `Version ${version} not found` });
            }

            // Create a new version with the old content + rollback changelog
            const newVersionNum = (prompt.activeVersion || 0) + 1;
            prompt.versions.push({
                version: newVersionNum,
                content: targetVersion.content,
                changelog: `Rollback to version ${version}`,
                createdBy: req.user.userId,
                createdAt: new Date()
            } as any);

            prompt.activeVersion = newVersionNum;
            prompt.updatedAt = new Date();
            await prompt.save();

            // Invalidate Cache
            if (prompt.type === 'core') {
                await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}CORE:PROD`);
                await redis.del(`${SYSTEM_PROMPT_KEY_PREFIX}CORE:TEST`);
            }

            res.json({ success: true, prompt, rolledBackTo: version, newVersion: newVersionNum });
        } catch (error) {
            res.status(500).json({ error: 'Failed to rollback version' });
        }
    }
}
