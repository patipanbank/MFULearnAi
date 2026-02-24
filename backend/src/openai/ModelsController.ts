/**
 * OpenAI-Compatible Models Controller
 *
 * GET  /v1/models      — List all available models
 * GET  /v1/models/:id  — Get a specific model
 */

import { Request, Response } from 'express';
import { getAvailableModelsOpenAI, resolveModelId, getOpenAIModelName, EMBEDDING_MODEL } from './modelMapping';
import type { ModelListResponse, ModelObject } from './types';

export class OpenAIModelsController {

    /**
     * GET /v1/models
     * List available models in OpenAI format.
     */
    static async listModels(req: Request, res: Response) {
        try {
            const models = getAvailableModelsOpenAI();

            // Add embedding model
            const embeddingModel: ModelObject = {
                id: EMBEDDING_MODEL.id,
                object: 'model',
                created: Math.floor(new Date('2025-01-01').getTime() / 1000),
                owned_by: 'amazon',
            };

            const response: ModelListResponse = {
                object: 'list',
                data: [
                    ...models,
                    embeddingModel,
                ],
            };

            res.json(response);
        } catch (error: any) {
            res.status(500).json({
                error: {
                    message: error.message || 'Failed to list models',
                    type: 'server_error',
                },
            });
        }
    }

    /**
     * GET /v1/models/:model
     * Retrieve a specific model.
     */
    static async getModel(req: Request, res: Response) {
        try {
            const modelId = req.params.model;

            // Check embedding model
            if (modelId === EMBEDDING_MODEL.id) {
                return res.json({
                    id: EMBEDDING_MODEL.id,
                    object: 'model',
                    created: Math.floor(new Date('2025-01-01').getTime() / 1000),
                    owned_by: 'amazon',
                });
            }

            const models = getAvailableModelsOpenAI();
            const model = models.find(m => m.id === modelId);

            if (!model) {
                return res.status(404).json({
                    error: {
                        message: `Model '${modelId}' not found.`,
                        type: 'invalid_request_error',
                        code: 'model_not_found',
                    },
                });
            }

            res.json(model);
        } catch (error: any) {
            res.status(500).json({
                error: {
                    message: error.message || 'Failed to get model',
                    type: 'server_error',
                },
            });
        }
    }
}
