import { Request, Response } from 'express';
import { BedrockService } from '../services/BedrockService';
import { LoggerService } from '../services/LoggerService';
import { validateModel } from '../bedrock/text/utils';

/**
 * CompletionsController — Simple synchronous chat completion for API Key "model" mode.
 *
 * Request:   POST /api/chat/completions
 * Headers:   Authorization: Bearer sk_model_xxx
 * Body:      { "message": "สวัสดี", "systemPrompt"?: "You are a helpful assistant." }
 *
 * Response:  { "message": "...", "model": "...", "usage": { input, output, total } }
 *
 * This is intentionally simple — no Socket.IO, no streaming, no tools, no history.
 * Designed for external integrations that just need a quick LLM response.
 */
export class CompletionsController {
    static async complete(req: any, res: Response) {
        try {
            const userId = req.user?.userId;
            if (!userId) return res.status(401).json({ error: 'Unauthorized' });

            // ── Validate API Key Mode ────────────────────────────
            if (!req.user.isApiKey) {
                return res.status(403).json({ error: 'This endpoint is only available via API Key (model mode)' });
            }
            if (req.user.apiKeyMode !== 'model') {
                return res.status(403).json({
                    error: 'This API Key is in "agent" mode. Use POST /api/chat instead, or create a "model" mode key.',
                    currentMode: req.user.apiKeyMode
                });
            }

            // ── Extract Input ────────────────────────────────────
            const { message, systemPrompt, temperature } = req.body;

            if (!message || typeof message !== 'string' || !message.trim()) {
                return res.status(400).json({ error: 'message is required (string)' });
            }

            const modelId = req.user.apiKeyModelId;
            if (!modelId) {
                return res.status(500).json({ error: 'No model configured for this API Key' });
            }

            // ── Build Messages ───────────────────────────────────
            const messages: any[] = [
                { role: 'user', content: message.trim() }
            ];

            const system = systemPrompt
                ? (typeof systemPrompt === 'string' ? systemPrompt : undefined)
                : undefined;

            // ── Call Bedrock ─────────────────────────────────────
            const finalModelId = validateModel(modelId);
            const result = await BedrockService.sendChat(
                finalModelId,
                messages,
                system,
                typeof temperature === 'number' ? Math.min(Math.max(temperature, 0), 1) : 0.5
            );

            // ── Log Usage ────────────────────────────────────────
            LoggerService.info('api_key_completion', {
                userId,
                model: finalModelId,
                inputTokens: result.usage?.input || 0,
                outputTokens: result.usage?.output || 0,
                totalTokens: result.usage?.total || 0,
                isApiKey: true,
                mode: 'model'
            }, userId);

            // ── Simple Response ──────────────────────────────────
            res.json({
                message: result.text,
                model: finalModelId,
                usage: {
                    input: result.usage?.input || 0,
                    output: result.usage?.output || 0,
                    total: result.usage?.total || 0,
                }
            });

        } catch (error: any) {
            LoggerService.error('completions_error', { error: error.message, stack: error.stack });
            if (!res.headersSent) {
                res.status(500).json({ error: 'Completion failed', details: error.message });
            }
        }
    }
}
