/**
 * OpenAI ↔ Bedrock Model Mapping
 * Maps user-friendly OpenAI-style model IDs to internal Bedrock model IDs.
 * External consumers use short names; the system resolves to Bedrock IDs internally.
 */

import { AVAILABLE_MODELS, RAW_MODELS, ModelConfig, MODEL_COST_WEIGHTS } from '../config/models';

// ── OpenAI-style aliases → Bedrock model IDs ──

const MODEL_ALIASES: Record<string, string> = {
    // Short names (OpenRouter-style)
    'claude-sonnet-4': RAW_MODELS.CLAUDE_SONNET_4,
    'claude-4-sonnet': RAW_MODELS.CLAUDE_SONNET_4,
    'claude-3.5-haiku': RAW_MODELS.CLAUDE_3_5_HAIKU,
    'claude-3-5-haiku': RAW_MODELS.CLAUDE_3_5_HAIKU,
    'qwen-vl-235b': RAW_MODELS.QWEN_3_VL_235B,
    'qwen-80b': RAW_MODELS.QWEN_3_80B_A3B,
    'mistral-large': RAW_MODELS.MISTRAL_LARGE_3,
    'kimi-k2': RAW_MODELS.KIMI_K2_THINKING,
    'gemma-3-4b': RAW_MODELS.GEMMA_3_4B_IT,
    'nemotron-nano': RAW_MODELS.NEMOTRON_NANO_12B_V2,
    'nova-pro': RAW_MODELS.NOVA_PRO,
    'nova-lite': RAW_MODELS.NOVA_LITE,
    'nova-micro': RAW_MODELS.NOVA_MICRO,

    // Legacy aliases (backward compat)
    'claude-3.5-sonnet': RAW_MODELS.CLAUDE_SONNET_4,
    'claude-3-5-sonnet': RAW_MODELS.CLAUDE_SONNET_4,
    'qwen-vl-72b': RAW_MODELS.QWEN_3_VL_235B,
    'qwen-72b': RAW_MODELS.QWEN_3_80B_A3B,

    // OpenAI-style with provider prefix
    'anthropic/claude-sonnet-4': RAW_MODELS.CLAUDE_SONNET_4,
    'anthropic/claude-3.5-haiku': RAW_MODELS.CLAUDE_3_5_HAIKU,
    'qwen/qwen-vl-235b': RAW_MODELS.QWEN_3_VL_235B,
    'qwen/qwen-80b': RAW_MODELS.QWEN_3_80B_A3B,
    'mistralai/mistral-large': RAW_MODELS.MISTRAL_LARGE_3,
    'moonshot/kimi-k2': RAW_MODELS.KIMI_K2_THINKING,
    'google/gemma-3-4b': RAW_MODELS.GEMMA_3_4B_IT,
    'nvidia/nemotron-nano': RAW_MODELS.NEMOTRON_NANO_12B_V2,
    'amazon/nova-pro': RAW_MODELS.NOVA_PRO,
    'amazon/nova-lite': RAW_MODELS.NOVA_LITE,
    'amazon/nova-micro': RAW_MODELS.NOVA_MICRO,

    // Also allow raw Bedrock IDs directly
    ...Object.fromEntries(Object.values(RAW_MODELS).map(id => [id, id])),
};

// Reverse mapping: Bedrock ID → preferred OpenAI-style name
const BEDROCK_TO_OPENAI: Record<string, string> = {
    [RAW_MODELS.CLAUDE_SONNET_4]: 'claude-sonnet-4',
    [RAW_MODELS.CLAUDE_3_5_HAIKU]: 'claude-3.5-haiku',
    [RAW_MODELS.CLAUDE_3_5_SONNET_V1]: 'claude-3.5-sonnet-v1',
    [RAW_MODELS.QWEN_3_VL_235B]: 'qwen-vl-235b',
    [RAW_MODELS.QWEN_3_80B_A3B]: 'qwen-80b',
    [RAW_MODELS.MISTRAL_LARGE_3]: 'mistral-large',
    [RAW_MODELS.KIMI_K2_THINKING]: 'kimi-k2',
    [RAW_MODELS.GEMMA_3_4B_IT]: 'gemma-3-4b',
    [RAW_MODELS.NEMOTRON_NANO_12B_V2]: 'nemotron-nano',
    [RAW_MODELS.NOVA_PRO]: 'nova-pro',
    [RAW_MODELS.NOVA_LITE]: 'nova-lite',
    [RAW_MODELS.NOVA_MICRO]: 'nova-micro',
};

/**
 * Resolve an OpenAI-style model name to a Bedrock model ID.
 * Returns null if the model is not found.
 */
export function resolveModelId(modelName: string): string | null {
    const normalized = modelName.toLowerCase().trim();
    return MODEL_ALIASES[normalized] || null;
}

/**
 * Get the OpenAI-style display name for a Bedrock model ID.
 */
export function getOpenAIModelName(bedrockId: string): string {
    return BEDROCK_TO_OPENAI[bedrockId] || bedrockId;
}

/**
 * Check if a model is available for external API access.
 */
export function isModelAvailable(modelName: string): boolean {
    const bedrockId = resolveModelId(modelName);
    if (!bedrockId) return false;
    return AVAILABLE_MODELS.some(m => m.id === bedrockId);
}

/**
 * Get all available models in OpenAI format.
 */
export function getAvailableModelsOpenAI(): Array<{
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
    capabilities: {
        vision: boolean;
        tools: boolean;
        streaming: boolean;
    };
    pricing: {
        cost_weight: number;
    };
}> {
    const created = Math.floor(new Date('2025-06-01').getTime() / 1000);

    return AVAILABLE_MODELS.map(m => ({
        id: getOpenAIModelName(m.id),
        object: 'model' as const,
        created,
        owned_by: m.provider,
        capabilities: {
            vision: m.type === 'vision' || m.id === RAW_MODELS.QWEN_3_VL_235B,
            tools: m.id === RAW_MODELS.NOVA_PRO || m.id === RAW_MODELS.MISTRAL_LARGE_3,
            streaming: true,
        },
        pricing: {
            cost_weight: MODEL_COST_WEIGHTS[m.id] || 1.0,
        },
    }));
}

/**
 * Get the embedding model info.
 */
export const EMBEDDING_MODEL = {
    id: 'text-embedding-titan-v1',
    bedrockId: 'amazon.titan-embed-text-v1',
    dimensions: 1536,
    maxInput: 8192,
};
