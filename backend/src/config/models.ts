/**
 * Centralized Model Configuration
 * All model IDs are defined here to avoid hardcoding across the codebase.
 */

export const MODELS = {
    /** Primary model for complex tasks (agent loop, chat, summarization) */
    PRIMARY: process.env.BEDROCK_PRIMARY_MODEL || 'anthropic.claude-3-5-sonnet-20240620-v1:0',

    /** Fast model for lightweight tasks (intent check, title generation) */
    FAST: process.env.BEDROCK_FAST_MODEL || 'anthropic.claude-3-5-sonnet-20240620-v1:0',
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
