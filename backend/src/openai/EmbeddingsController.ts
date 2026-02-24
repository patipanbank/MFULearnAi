/**
 * OpenAI-Compatible Embeddings Controller
 *
 * POST /v1/embeddings
 * Auth: Bearer sk_model_xxx
 *
 * Uses AWS Bedrock Titan Embed v1 under the hood.
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { BedrockEmbeddingService } from '../bedrock/embedding';
import { LoggerService } from '../services/LoggerService';
import { ApiKeyUsageService } from '../services/ApiKeyUsageService';
import { EMBEDDING_MODEL } from './modelMapping';
import type { EmbeddingRequest, EmbeddingResponse, EmbeddingData } from './types';

export class OpenAIEmbeddingsController {

    /**
     * POST /v1/embeddings
     * Create embeddings for the given input.
     */
    static async createEmbedding(req: any, res: Response) {
        try {
            const userId = req.user?.userId;
            if (!userId) {
                return res.status(401).json({
                    error: { message: 'Authentication required', type: 'authentication_error' },
                });
            }

            if (!req.user.isApiKey) {
                return res.status(403).json({
                    error: { message: 'This endpoint requires an API key.', type: 'invalid_request_error' },
                });
            }

            const body: EmbeddingRequest = req.body;

            // Validate model
            const requestedModel = body.model || EMBEDDING_MODEL.id;
            if (requestedModel !== EMBEDDING_MODEL.id && requestedModel !== 'text-embedding-titan-v1') {
                return res.status(400).json({
                    error: {
                        message: `Model '${requestedModel}' is not an embedding model. Use '${EMBEDDING_MODEL.id}'.`,
                        type: 'invalid_request_error',
                        code: 'model_not_found',
                    },
                });
            }

            // Validate input
            if (!body.input) {
                return res.status(400).json({
                    error: { message: "'input' is required.", type: 'invalid_request_error' },
                });
            }

            const inputs: string[] = Array.isArray(body.input) ? body.input : [body.input];

            if (inputs.length === 0 || inputs.some(i => typeof i !== 'string' || !i.trim())) {
                return res.status(400).json({
                    error: { message: "'input' must be a non-empty string or array of strings.", type: 'invalid_request_error' },
                });
            }

            // ── Generate Embeddings (batch) ──
            const data: EmbeddingData[] = [];
            let totalTokens = 0;

            for (let i = 0; i < inputs.length; i++) {
                const text = inputs[i].trim();
                const embedding = await BedrockEmbeddingService.getEmbedding(text);
                // Rough token estimate: ~4 chars per token
                const estimatedTokens = Math.ceil(text.length / 4);
                totalTokens += estimatedTokens;

                data.push({
                    object: 'embedding',
                    index: i,
                    embedding,
                });
            }

            const response: EmbeddingResponse = {
                object: 'list',
                data,
                model: EMBEDDING_MODEL.id,
                usage: {
                    prompt_tokens: totalTokens,
                    total_tokens: totalTokens,
                },
            };

            // ── Track Usage ──
            ApiKeyUsageService.trackUsage(req.apiKey?._id?.toString(), {
                model: EMBEDDING_MODEL.bedrockId,
                promptTokens: totalTokens,
                completionTokens: 0,
                totalTokens,
                weightedTokens: Math.round(totalTokens * 0.01), // Embeddings are very cheap
                endpoint: '/v1/embeddings',
                streaming: false,
            }).catch(() => {});

            LoggerService.info('openai_embedding', {
                userId,
                model: EMBEDDING_MODEL.id,
                inputCount: inputs.length,
                totalTokens,
                isApiKey: true,
            }, userId);

            res.json(response);

        } catch (error: any) {
            LoggerService.error('openai_embedding_error', { error: error.message });
            if (!res.headersSent) {
                res.status(500).json({
                    error: { message: error.message || 'Embedding failed', type: 'server_error' },
                });
            }
        }
    }
}
