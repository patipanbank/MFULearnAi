/**
 * Centralized Model Configuration
 * All model IDs are defined here to avoid hardcoding across the codebase.
 * Includes cost weights for weighted token quota system.
 */

export interface ModelConfig {
    id: string;
    name: string;
    provider: 'anthropic' | 'meta' | 'mistral' | 'amazon' | 'aliyun';
    contextWindow: number;
    type: 'fast' | 'smart' | 'vision' | 'embedding';
    /** Relative cost multiplier. 1.0 = most expensive baseline (Claude 3.5 Sonnet). */
    costWeight: number;
    isDefault?: boolean;
}

// 1. RAW MODEL DEFINITIONS (The "Database" of known models)
export const RAW_MODELS = {
    // Anthropic
    CLAUDE_3_5_SONNET: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    // Qwen (Aliyun)
    QWEN_2_5_VL_72B: 'qwen.qwen3-vl-235b-a22b',
    QWEN_80B_A3B: 'qwen.qwen3-next-80b-a3b',
    // Moonshot AI
    KIMI_K2_THINKING: 'moonshot.kimi-k2-thinking',
    //Mistral AI
    MISTRAL_LARGE_3: 'mistral.mistral-large-3-675b-instruct',
    //Google AI
    GEMMA_3_4B_IT: 'google.gemma-3-4b-it',
    //Nvidia AI
    NEMOTRON_NANO_12B_V2: 'nvidia.nemotron-nano-12b-v2',
    // Cohere (Reranker — cross-encoder, not generative)
    COHERE_RERANK_V3_5: 'cohere.rerank-v3-5:0',
} as const;

// 2. ACTIVE SYSTEM CONFIGURATION (The "Configuration" of what to use)
// This maps functional roles to specific valid model IDs.
export const SYSTEM_MODELS = {
    AGENT: RAW_MODELS.CLAUDE_3_5_SONNET,
    CHAT: RAW_MODELS.MISTRAL_LARGE_3,
    /** Lightweight LLM for policy compliance analysis (NOT a cross-encoder reranker) */
    RERANK: RAW_MODELS.GEMMA_3_4B_IT,
    SUMMARIZE: RAW_MODELS.QWEN_80B_A3B,
    UTILITY: RAW_MODELS.NEMOTRON_NANO_12B_V2,
    /** Cohere cross-encoder reranker for RAG pipeline (two-stage retrieval) */
    COHERE_RERANK: RAW_MODELS.COHERE_RERANK_V3_5,
} as const;

// 3. AVAILABLE MODELS LIST (The "Menu" for the UI/Validation)
export const AVAILABLE_MODELS: ModelConfig[] = [
    {
        id: RAW_MODELS.CLAUDE_3_5_SONNET,
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        contextWindow: 200000,
        type: 'smart',
        costWeight: 1.0
    },
    {
        id: RAW_MODELS.QWEN_2_5_VL_72B,
        name: 'Qwen 2.5 VL 72B',
        provider: 'aliyun',
        contextWindow: 32000,
        type: 'smart',
        costWeight: 0.15
    },
    {
        id: RAW_MODELS.QWEN_80B_A3B,
        name: 'Qwen 2.5 72B',
        provider: 'aliyun',
        contextWindow: 32000,
        type: 'fast',
        costWeight: 0.10
    }
];

// 3b. COST WEIGHTS (All known models, including system-only)
// Relative to Claude 3.5 Sonnet (1.0). Based on approximate $/1M token ratios.
// Update these when provider pricing changes.
export const MODEL_COST_WEIGHTS: Record<string, number> = {
    [RAW_MODELS.CLAUDE_3_5_SONNET]: 1.0,
    [RAW_MODELS.MISTRAL_LARGE_3]: 0.50,
    [RAW_MODELS.KIMI_K2_THINKING]: 0.30,
    [RAW_MODELS.QWEN_2_5_VL_72B]: 0.15,
    [RAW_MODELS.QWEN_80B_A3B]: 0.10,
    [RAW_MODELS.NEMOTRON_NANO_12B_V2]: 0.03,
    [RAW_MODELS.GEMMA_3_4B_IT]: 0.02,
};

/** Get cost weight for a model. Defaults to 1.0 for unknown models (safe — never under-count). */
export function getCostWeight(modelId: string): number {
    return MODEL_COST_WEIGHTS[modelId] ?? 1.0;
}

/** Compute weighted token units (cost-normalized). */
export function computeWeightedTokens(rawTokens: number, modelId: string): number {
    return Math.round(rawTokens * getCostWeight(modelId));
}

// Helper to get ID for a type (fallback logic)
export const getModelId = (type: 'smart' | 'fast'): string => {
    return type === 'smart' ? SYSTEM_MODELS.CHAT : SYSTEM_MODELS.UTILITY;
};

// 4. LEGACY EXPORTS (Deprecated)
// Backward compatibility for existing code using MODELS.PRIMARY/FAST
export const MODELS = {
    /** Primary model for complex tasks */
    get PRIMARY() { return SYSTEM_MODELS.AGENT; },

    /** Fast model for lightweight tasks */
    get FAST() { return SYSTEM_MODELS.UTILITY; },

    // Map legacy keys to current system choices or raw models
    claude35: SYSTEM_MODELS.CHAT,
    claudeHaiku: SYSTEM_MODELS.UTILITY
} as const;

export const BEDROCK_MODELS = {
    CLAUDE_3_5_SONNET: SYSTEM_MODELS.CHAT,
    CLAUDE_3_HAIKU: SYSTEM_MODELS.UTILITY
} as const;
