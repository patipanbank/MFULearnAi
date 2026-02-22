/**
 * Centralized Quota Configuration
 * Defines daily token limits and warning thresholds.
 * Values are configurable via environment variables for production flexibility.
 */

export const QUOTA_CONFIG = {
    /** Daily weighted-token limit per user. Env: DAILY_TOKEN_LIMIT */
    DAILY_LIMIT: parseInt(process.env.DAILY_TOKEN_LIMIT || '50000', 10),

    /** Fraction of daily limit at which the frontend shows a warning (0.0–1.0). */
    WARNING_THRESHOLD: parseFloat(process.env.DAILY_TOKEN_WARNING || '0.8'),

    /** If true, the backend will reject requests that exceed the daily limit.
     *  If false, the limit is advisory-only (soft limit). */
    HARD_LIMIT_ENABLED: process.env.DAILY_TOKEN_HARD_LIMIT === 'true',

    /** Label displayed in the frontend for the quota unit. */
    UNIT_LABEL: 'cost units',
} as const;
