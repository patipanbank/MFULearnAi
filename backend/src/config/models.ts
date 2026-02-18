/**
 * Centralized Model Configuration
 * All model IDs are defined here to avoid hardcoding across the codebase.
 */

export interface ModelConfig {
    id: string;
    name: string;
    provider: 'anthropic' | 'meta' | 'mistral' | 'amazon';
    contextWindow: number;
    type: 'fast' | 'smart' | 'vision' | 'embedding';
    isDefault?: boolean;
}

export const BEDROCK_MODELS = {
    CLAUDE_3_5_SONNET: process.env.BEDROCK_PRIMARY_MODEL || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
    CLAUDE_3_HAIKU: process.env.BEDROCK_FAST_MODEL || 'anthropic.claude-3-haiku-20240307-v1:0',
} as const;

export const AVAILABLE_MODELS: ModelConfig[] = [
    {
        id: BEDROCK_MODELS.CLAUDE_3_5_SONNET,
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        contextWindow: 200000,
        type: 'smart',
        isDefault: true
    },
    {
        id: BEDROCK_MODELS.CLAUDE_3_HAIKU,
        name: 'Claude 3 Haiku',
        provider: 'anthropic',
        contextWindow: 200000,
        type: 'fast',
        isDefault: true
    }
];

export const getModelId = (type: 'smart' | 'fast'): string => {
    const model = AVAILABLE_MODELS.find(m => m.type === type && m.isDefault);
    return model ? model.id : (type === 'smart' ? BEDROCK_MODELS.CLAUDE_3_5_SONNET : BEDROCK_MODELS.CLAUDE_3_HAIKU);
};

export const MODELS = {
    /** Primary model for complex tasks (agent loop, chat, summarization) */
    get PRIMARY() { return getModelId('smart'); },

    /** Fast model for lightweight tasks (intent check, title generation) */
    get FAST() { return getModelId('fast'); },

    // Legacy mapping for compatibility
    claude35: BEDROCK_MODELS.CLAUDE_3_5_SONNET,
    claudeHaiku: BEDROCK_MODELS.CLAUDE_3_HAIKU
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
