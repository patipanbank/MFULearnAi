/**
 * Model Router — Handles model routing, fallback, and load balancing.
 *
 * Features:
 * - Resolves model IDs from OpenAI-style names to Bedrock IDs
 * - Automatic fallback to secondary model on failure
 * - Model access control per API key
 * - Circuit breaker pattern for failing models
 */

import { redis } from '../config/redis';
import { resolveModelId, getOpenAIModelName } from '../openai/modelMapping';
import { AVAILABLE_MODELS } from '../config/models';
import { LoggerService } from './LoggerService';

const CIRCUIT_BREAKER_THRESHOLD = 5;    // Failures before opening circuit
const CIRCUIT_BREAKER_WINDOW = 300;      // 5 minute window
const CIRCUIT_BREAKER_COOLDOWN = 60;     // 1 minute cooldown before retry

export interface ModelRouteResult {
    modelId: string;             // Resolved Bedrock model ID
    openAIName: string;          // OpenAI-style display name
    isFallback: boolean;         // Whether fallback was used
    originalModel?: string;      // Original requested model (if fallback)
}

export class ModelRouter {

    /**
     * Route a model request: resolve ID, check access, handle fallback.
     */
    static async route(
        requestedModel: string,
        apiKeyModelId?: string,
        allowedModels?: string[],
        fallbackModelId?: string,
    ): Promise<ModelRouteResult> {
        // 1. Resolve the requested model
        const primaryId = resolveModelId(requestedModel);
        if (!primaryId) {
            throw new ModelRoutingError(`Model '${requestedModel}' not found.`, 'model_not_found');
        }

        // 2. Check access control
        if (allowedModels && allowedModels.length > 0 && !allowedModels.includes('*')) {
            if (!allowedModels.includes(primaryId)) {
                throw new ModelRoutingError(
                    `This API key does not have access to model '${requestedModel}'.`,
                    'model_not_allowed'
                );
            }
        }

        // 3. Check circuit breaker
        const isCircuitOpen = await ModelRouter.isCircuitOpen(primaryId);
        if (!isCircuitOpen) {
            return {
                modelId: primaryId,
                openAIName: getOpenAIModelName(primaryId),
                isFallback: false,
            };
        }

        // 4. Primary circuit is open — try fallback
        LoggerService.warn('model_circuit_open', { model: primaryId, requestedModel });

        if (fallbackModelId) {
            const fallbackOpen = await ModelRouter.isCircuitOpen(fallbackModelId);
            if (!fallbackOpen) {
                return {
                    modelId: fallbackModelId,
                    openAIName: getOpenAIModelName(fallbackModelId),
                    isFallback: true,
                    originalModel: requestedModel,
                };
            }
        }

        // 5. Try any available model as last resort
        for (const model of AVAILABLE_MODELS) {
            if (model.id !== primaryId && model.id !== fallbackModelId) {
                const circuitOpen = await ModelRouter.isCircuitOpen(model.id);
                if (!circuitOpen) {
                    return {
                        modelId: model.id,
                        openAIName: getOpenAIModelName(model.id),
                        isFallback: true,
                        originalModel: requestedModel,
                    };
                }
            }
        }

        // All circuits open — try primary anyway
        return {
            modelId: primaryId,
            openAIName: getOpenAIModelName(primaryId),
            isFallback: false,
        };
    }

    /**
     * Record a model failure (increment circuit breaker counter).
     */
    static async recordFailure(modelId: string): Promise<void> {
        try {
            const key = `circuit:${modelId}`;
            const count = await redis.incr(key);
            if (count === 1) await redis.expire(key, CIRCUIT_BREAKER_WINDOW);

            if (count >= CIRCUIT_BREAKER_THRESHOLD) {
                // Open the circuit
                await redis.set(`circuit:open:${modelId}`, '1', 'EX', CIRCUIT_BREAKER_COOLDOWN);
                LoggerService.warn('model_circuit_opened', { modelId, failures: count });
            }
        } catch { /* Redis error — ignore */ }
    }

    /**
     * Record a model success (reset circuit breaker).
     */
    static async recordSuccess(modelId: string): Promise<void> {
        try {
            await redis.del(`circuit:${modelId}`);
            await redis.del(`circuit:open:${modelId}`);
        } catch { /* ignore */ }
    }

    /**
     * Check if circuit breaker is open for a model.
     */
    static async isCircuitOpen(modelId: string): Promise<boolean> {
        try {
            const open = await redis.get(`circuit:open:${modelId}`);
            return open === '1';
        } catch {
            return false; // Fail closed (assume circuit is OK)
        }
    }

    /**
     * Get health status for all models.
     */
    static async getModelHealth(): Promise<Array<{ modelId: string; name: string; healthy: boolean; failures: number }>> {
        const results = [];
        for (const model of AVAILABLE_MODELS) {
            let failures = 0;
            let healthy = true;
            try {
                const count = await redis.get(`circuit:${model.id}`);
                failures = count ? parseInt(count, 10) : 0;
                const open = await redis.get(`circuit:open:${model.id}`);
                healthy = open !== '1';
            } catch { /* ignore */ }

            results.push({
                modelId: model.id,
                name: getOpenAIModelName(model.id),
                healthy,
                failures,
            });
        }
        return results;
    }
}

export class ModelRoutingError extends Error {
    code: string;
    constructor(message: string, code: string) {
        super(message);
        this.code = code;
        this.name = 'ModelRoutingError';
    }
}
