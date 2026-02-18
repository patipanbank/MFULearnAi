/**
 * Centralized Model Configuration
 * All model IDs are defined here to avoid hardcoding across the codebase.
 */

export const BEDROCK_MODELS = {
    CLAUDE_3_5_SONNET: process.env.BEDROCK_PRIMARY_MODEL || 'anthropic.claude-sonnet-4-6',
    CLAUDE_3_HAIKU: process.env.BEDROCK_FAST_MODEL || 'anthropic.claude-haiku-4-5-20251001-v1:0',
} as const;

export const MODELS = {
    /** Primary model for complex tasks (agent loop, chat, summarization) */
    PRIMARY: BEDROCK_MODELS.CLAUDE_3_5_SONNET,

    /** Fast model for lightweight tasks (intent check, title generation) */
    FAST: BEDROCK_MODELS.CLAUDE_3_HAIKU,

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
