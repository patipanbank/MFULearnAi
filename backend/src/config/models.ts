/**
 * Centralized Model Configuration
 * All model IDs are defined here to avoid hardcoding across the codebase.
 */

/**
 * Centralized Model Configuration
 * All model IDs are defined here to avoid hardcoding across the codebase.
 */

export interface ModelConfig {
    id: string;
    name: string;
    provider: 'anthropic' | 'meta' | 'mistral' | 'amazon' | 'aliyun'; // Added 'aliyun' for Qwen
    contextWindow: number;
    type: 'fast' | 'smart' | 'vision' | 'embedding';
    isDefault?: boolean;
}

// 1. RAW MODEL DEFINITIONS (The "Database" of known models)
export const RAW_MODELS = {
    // Anthropic
    CLAUDE_3_5_SONNET: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    CLAUDE_3_HAIKU: 'anthropic.claude-3-haiku-20240307-v1:0',
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
} as const;

// 2. ACTIVE SYSTEM CONFIGURATION (The "Configuration" of what to use)
// This maps functional roles to specific valid model IDs.
export const SYSTEM_MODELS = {
    AGENT: RAW_MODELS.KIMI_K2_THINKING,
    CHAT: RAW_MODELS.MISTRAL_LARGE_3,
    RERANK: RAW_MODELS.GEMMA_3_4B_IT,
    SUMMARIZE: RAW_MODELS.QWEN_80B_A3B,
    UTILITY: RAW_MODELS.NEMOTRON_NANO_12B_V2,
} as const;

// 3. AVAILABLE MODELS LIST (The "Menu" for the UI/Validation)
export const AVAILABLE_MODELS: ModelConfig[] = [
    {
        id: RAW_MODELS.CLAUDE_3_5_SONNET,
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        contextWindow: 200000,
        type: 'smart'
    },
    {
        id: RAW_MODELS.CLAUDE_3_HAIKU,
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        contextWindow: 200000,
        type: 'fast'
    },
    {
        id: RAW_MODELS.QWEN_2_5_VL_72B,
        name: 'Qwen 2.5 VL 72B', // Or whatever precise name matches the ID
        provider: 'aliyun',
        contextWindow: 32000, // Verify specific context window
        type: 'smart'
    },
    {
        id: RAW_MODELS.QWEN_80B_A3B,
        name: 'Qwen 2.5 72B',
        provider: 'aliyun',
        contextWindow: 32000,
        type: 'fast'
    }
];

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


/** Agent loop configuration */
export const AGENT_CONFIG = {
    /** Maximum tool-use iterations before forcing a response */
    MAX_STEPS: 8,

    /** Maximum wall-clock time (ms) for the entire agent loop */
    MAX_WALL_MS: 120_000, // 2 minutes

    /** Bedrock request timeout (ms) per step */
    STEP_TIMEOUT_MS: 60_000,
} as const;
