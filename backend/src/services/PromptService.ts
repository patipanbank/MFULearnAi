import { redis } from '../config/redis';
import Prompt from '../models/Prompt';
import { getSystemPrompt, CONTEXT_PROMPTS } from '../config/systemPrompts';

const SYSTEM_PROMPT_KEY_PREFIX = 'system_prompt:';

/**
 * Available template variables that can be used in prompts.
 * Variables use the format: {{variableName}}
 * 
 * Each variable defines:
 * - key: The variable identifier (used in {{key}} syntax)
 * - label: Human-readable label for the UI
 * - description: What this variable resolves to
 * - category: Grouping for UI display
 * - sampleValue: Example value shown in preview mode
 */
export interface PromptVariable {
    key: string;
    label: string;
    description: string;
    category: 'user' | 'session' | 'system' | 'context';
    sampleValue: string;
}

/** Registry of all supported dynamic variables */
export const PROMPT_VARIABLES: PromptVariable[] = [
    // User variables
    { key: 'userRole', label: 'User Role', description: 'Current user role (student, admin, superadmin)', category: 'user', sampleValue: 'student' },
    { key: 'userDepartment', label: 'User Department', description: 'User department name', category: 'user', sampleValue: 'School of Information Technology' },
    { key: 'userName', label: 'User Name', description: 'Display name of the user', category: 'user', sampleValue: 'Somchai' },

    // Session variables
    { key: 'sessionId', label: 'Session ID', description: 'Current chat session identifier', category: 'session', sampleValue: 'sess_abc123' },
    { key: 'messageCount', label: 'Message Count', description: 'Number of messages in current session', category: 'session', sampleValue: '5' },

    // System variables
    { key: 'date', label: 'Current Date', description: 'Today\'s date in Thai locale', category: 'system', sampleValue: new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) },
    { key: 'time', label: 'Current Time', description: 'Current time in Thai locale', category: 'system', sampleValue: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) },
    { key: 'environment', label: 'Environment', description: 'Current deployment environment (TEST or PROD)', category: 'system', sampleValue: 'TEST' },
    { key: 'modelId', label: 'Model ID', description: 'Active AI model identifier', category: 'system', sampleValue: 'anthropic.claude-3-5-sonnet' },

    // Context variables
    { key: 'hasFiles', label: 'Has Files', description: 'Whether user has attached files', category: 'context', sampleValue: 'false' },
    { key: 'hasPolicyContext', label: 'Has Policy Context', description: 'Whether policy context is available', category: 'context', sampleValue: 'false' },
    { key: 'toolList', label: 'Available Tools', description: 'Comma-separated list of available tool names', category: 'context', sampleValue: 'search, calculator' },
];

/** Values resolved at runtime for variable substitution */
export interface PromptVariableValues {
    userRole?: string;
    userDepartment?: string;
    userName?: string;
    sessionId?: string;
    messageCount?: string;
    date?: string;
    time?: string;
    environment?: string;
    modelId?: string;
    hasFiles?: string;
    hasPolicyContext?: string;
    toolList?: string;
    [key: string]: string | undefined;
}

export class PromptService {
    /**
     * Get the active core system prompt from DB, with Redis cache.
     * Falls back to hardcoded config if no active prompt exists in DB.
     */
    static async getCoreSystemPrompt(envType: 'TEST' | 'PROD'): Promise<string> {
        const cacheKey = `${SYSTEM_PROMPT_KEY_PREFIX}CORE:${envType}`;
        const cached = await redis.get(cacheKey);
        if (cached) return cached;

        const fallbackKey = envType === 'PROD' ? 'DINDINAI_SYSTEM_PROMPT' : 'MFULEARNAI_SYSTEM_PROMPT';

        const promptDoc = await Prompt.findOne({
            type: 'core',
            isActive: true,
            $or: [{ key: fallbackKey }, { tags: envType }]
        });

        if (promptDoc) {
            const content = promptDoc.versions.find(v => v.version === promptDoc.activeVersion)?.content || promptDoc.versions[0]?.content || '';
            await redis.set(cacheKey, content, 'EX', 300);
            return content;
        }

        return getSystemPrompt(envType);
    }

    /**
     * Get the resolved system prompt for the agent, with variables substituted.
     * This is the primary method the AgentWorkflow should call.
     */
    static async getResolvedAgentPrompt(
        envType: 'TEST' | 'PROD',
        variables: PromptVariableValues
    ): Promise<string> {
        const rawPrompt = await this.getCoreSystemPrompt(envType);
        return this.substituteVariables(rawPrompt, variables);
    }

    /**
     * Substitute {{variable}} placeholders with actual values.
     * Unknown variables are left as-is to avoid data loss.
     */
    static substituteVariables(template: string, values: PromptVariableValues): string {
        return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            const value = values[key];
            // Leave unknown variables as-is so the prompt author sees them
            return value !== undefined ? value : match;
        });
    }

    /**
     * Preview a prompt with sample values (for the admin UI).
     * Uses sample values from PROMPT_VARIABLES registry.
     */
    static previewWithSampleValues(template: string, overrides?: Record<string, string>): string {
        const sampleValues: PromptVariableValues = {};
        for (const v of PROMPT_VARIABLES) {
            sampleValues[v.key] = v.sampleValue;
        }
        // Allow overrides for custom preview
        if (overrides) {
            Object.assign(sampleValues, overrides);
        }
        return this.substituteVariables(template, sampleValues);
    }

    /**
     * Returns all available template variables for the admin UI.
     */
    static getAvailableVariables(): PromptVariable[] {
        return PROMPT_VARIABLES;
    }

    static async getScenarioPrompt(scenarioId: string, userId: string): Promise<string> {
        const cacheKey = `${SYSTEM_PROMPT_KEY_PREFIX}SCENARIO:${scenarioId}`;
        const cached = await redis.get(cacheKey);
        if (cached) return cached;

        const prompt = await Prompt.findOne({ _id: scenarioId });
        if (!prompt) return '';

        if (!prompt.isPublic && prompt.ownerId !== userId) return '';

        const content = prompt.versions.find(v => v.version === prompt.activeVersion)?.content || '';
        if (content) {
            await redis.set(cacheKey, content, 'EX', 300);
        }
        return content;
    }

    static getContextPrompt(contextKey: string): string {
        return (CONTEXT_PROMPTS as any)[contextKey] || '';
    }
}
