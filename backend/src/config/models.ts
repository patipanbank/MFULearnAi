/**
 * Centralized Model Configuration
 * All model IDs are defined here to avoid hardcoding across the codebase.
 * Includes cost weights for weighted token quota system.
 */

export interface ModelConfig {
    id: string;
    name: string;
    provider: 'anthropic' | 'meta' | 'mistral' | 'amazon' | 'aliyun' | 'google' | 'nvidia' | 'moonshot';
    contextWindow: number;
    type: 'fast' | 'smart' | 'vision' | 'embedding';
    /** Relative cost multiplier. 1.0 = most expensive baseline (Claude Sonnet 4). */
    costWeight: number;
    isDefault?: boolean;
}

// ═══════════════════════════════════════════════════════════════════
// 1. RAW MODEL DEFINITIONS — The "Database" of known Bedrock model IDs
//    Region: us-east-1
//    ⚠ Channel program account — Anthropic models are BLOCKED.
//       All other providers (Amazon, Qwen, Mistral, Cohere, etc.) work fine.
// ═══════════════════════════════════════════════════════════════════
export const RAW_MODELS = {
    // ── Amazon Nova (native AWS) ──────────────────────────────────
    NOVA_PRO: 'amazon.nova-pro-v1:0',
    NOVA_LITE: 'amazon.nova-lite-v1:0',
    NOVA_MICRO: 'amazon.nova-micro-v1:0',

    // ── Qwen (Aliyun) ────────────────────────────────────────────
    QWEN_3_VL_235B: 'qwen.qwen3-vl-235b-a22b',
    QWEN_3_80B_A3B: 'qwen.qwen3-next-80b-a3b',

    // ── Moonshot AI ───────────────────────────────────────────────
    KIMI_K2_THINKING: 'moonshot.kimi-k2-thinking',

    // ── Mistral AI ────────────────────────────────────────────────
    MISTRAL_LARGE_3: 'mistral.mistral-large-3-675b-instruct',

    // ── Google AI ─────────────────────────────────────────────────
    GEMMA_3_4B_IT: 'google.gemma-3-4b-it',

    // ── Nvidia AI ─────────────────────────────────────────────────
    NEMOTRON_NANO_12B_V2: 'nvidia.nemotron-nano-12b-v2',

    // ── Cohere (Reranker — cross-encoder, not generative) ─────────
    COHERE_RERANK_V3_5: 'cohere.rerank-v3-5:0',

    // ── Anthropic — BLOCKED on channel program account ────────────
    /** @blocked Channel account — Anthropic not available */
    CLAUDE_SONNET_4: 'anthropic.claude-sonnet-4-6',
    /** @blocked */ CLAUDE_3_5_HAIKU: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    /** @blocked @deprecated */ CLAUDE_3_5_SONNET_V1: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
} as const;

// ═══════════════════════════════════════════════════════════════════
// 2. ACTIVE SYSTEM CONFIGURATION — Maps functional roles → model IDs
//    ⚠ Anthropic (Claude) is blocked — AGENT uses Nova Pro instead.
//       All other roles use non-Anthropic models as before.
// ═══════════════════════════════════════════════════════════════════
export const SYSTEM_MODELS = {
    /** Primary agent (tool calling, reasoning). Nova Pro replaces Claude (blocked). */
    AGENT: RAW_MODELS.NOVA_PRO,
    /** General chat / conversation. Mistral Large 3 — fast & capable. */
    CHAT: RAW_MODELS.MISTRAL_LARGE_3,
    /** Lightweight LLM for policy compliance analysis. */
    RERANK: RAW_MODELS.GEMMA_3_4B_IT,
    /** Summarization, query rewriting. Qwen MoE — great cost/quality. */
    SUMMARIZE: RAW_MODELS.QWEN_3_80B_A3B,
    /** Cheapest tasks: memory extraction, title generation. */
    UTILITY: RAW_MODELS.NOVA_MICRO,
    /** Cohere cross-encoder reranker for RAG pipeline (two-stage retrieval) */
    COHERE_RERANK: RAW_MODELS.COHERE_RERANK_V3_5,
} as const;

// ═══════════════════════════════════════════════════════════════════
// 3. AVAILABLE MODELS LIST — User-facing "Menu" for UI/Validation
// ═══════════════════════════════════════════════════════════════════
export const AVAILABLE_MODELS: ModelConfig[] = [
    {
        id: RAW_MODELS.NOVA_PRO,
        name: 'Amazon Nova Pro',
        provider: 'amazon',
        contextWindow: 300000,
        type: 'smart',
        costWeight: 0.20,
        isDefault: true
    },
    {
        id: RAW_MODELS.MISTRAL_LARGE_3,
        name: 'Mistral Large 3',
        provider: 'mistral',
        contextWindow: 131000,
        type: 'smart',
        costWeight: 0.50
    },
    {
        id: RAW_MODELS.QWEN_3_VL_235B,
        name: 'Qwen 3 VL 235B',
        provider: 'aliyun',
        contextWindow: 32000,
        type: 'vision',
        costWeight: 0.15
    },
    {
        id: RAW_MODELS.NOVA_LITE,
        name: 'Amazon Nova Lite',
        provider: 'amazon',
        contextWindow: 300000,
        type: 'fast',
        costWeight: 0.02
    },
];

// 3b. COST WEIGHTS (All known models, including system-only)
// Relative to Claude Sonnet 4 (1.0). Based on approximate $/1M token ratios.
// Update these when provider pricing changes.
export const MODEL_COST_WEIGHTS: Record<string, number> = {
    [RAW_MODELS.CLAUDE_SONNET_4]: 1.0,       // $3/M in, $15/M out
    [RAW_MODELS.CLAUDE_3_5_HAIKU]: 0.25,     // $0.80/M in, $4/M out
    [RAW_MODELS.CLAUDE_3_5_SONNET_V1]: 1.0,  // legacy — same tier
    [RAW_MODELS.MISTRAL_LARGE_3]: 0.50,      // $2/M in, $6/M out
    [RAW_MODELS.KIMI_K2_THINKING]: 0.30,
    [RAW_MODELS.QWEN_3_VL_235B]: 0.15,
    [RAW_MODELS.QWEN_3_80B_A3B]: 0.10,
    [RAW_MODELS.NOVA_PRO]: 0.20,             // $0.80/M in, $3.20/M out
    [RAW_MODELS.NOVA_LITE]: 0.02,            // $0.06/M in, $0.24/M out
    [RAW_MODELS.NOVA_MICRO]: 0.01,           // $0.035/M in, $0.14/M out
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
    return type === 'smart' ? SYSTEM_MODELS.AGENT : SYSTEM_MODELS.UTILITY;
};

// 4. LEGACY EXPORTS (Deprecated)
// Backward compatibility for existing code using MODELS.PRIMARY/FAST
export const MODELS = {
    /** Primary model for complex tasks */
    get PRIMARY() { return SYSTEM_MODELS.AGENT; },

    /** Fast model for lightweight tasks */
    get FAST() { return SYSTEM_MODELS.UTILITY; },

    // Map legacy keys to current system choices
    claude35: SYSTEM_MODELS.CHAT,
    claudeHaiku: SYSTEM_MODELS.UTILITY
} as const;

export const BEDROCK_MODELS = {
    CLAUDE_3_5_SONNET: SYSTEM_MODELS.AGENT,
    CLAUDE_3_HAIKU: SYSTEM_MODELS.UTILITY
} as const;
