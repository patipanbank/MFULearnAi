import { redis } from '../config/redis';
import Prompt from '../models/Prompt';
import { getSystemPrompt, CONTEXT_PROMPTS } from '../config/systemPrompts';

const SYSTEM_PROMPT_KEY_PREFIX = 'system_prompt:';

export class PromptService {
    static async getCoreSystemPrompt(envType: 'TEST' | 'PROD'): Promise<string> {
        const cacheKey = `${SYSTEM_PROMPT_KEY_PREFIX}CORE:${envType}`;
        const cached = await redis.get(cacheKey);
        if (cached) {
            console.log(`[PromptService] Cache Hit for ${envType}`);
            return cached;
        }

        const fallbackKey = envType === 'PROD' ? 'DINDINAI_SYSTEM_PROMPT' : 'MFULEARNAI_SYSTEM_PROMPT';
        console.log(`[PromptService] Fetching from DB. Env: ${envType}, FallbackKey: ${fallbackKey}`);

        const promptDoc = await Prompt.findOne({
            type: 'core',
            isActive: true,
            $or: [{ key: fallbackKey }, { tags: envType }]
        }).sort({ updatedAt: -1 });

        if (promptDoc) {
            console.log(`[PromptService] Found DB Prompt: ${promptDoc.key} (ID: ${promptDoc._id})`);
            const content = promptDoc.versions.find(v => v.version === promptDoc.activeVersion)?.content || promptDoc.versions[0]?.content || '';
            await redis.set(cacheKey, content, 'EX', 300);
            return content;
        }

        console.log(`[PromptService] No Active DB Prompt found. Using Hardcoded Fallback.`);
        return getSystemPrompt(envType);
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
