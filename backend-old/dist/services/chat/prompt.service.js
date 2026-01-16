"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptService = exports.PromptService = void 0;
const SystemPrompt_1 = require("../../models/SystemPrompt");
/**
 * Service for managing system prompts
 */
class PromptService {
    constructor() {
        this.defaultSystemPrompt = `You are DinDin 🤖, a male AI assistant for Mae Fah Luang University.

Response Style 🎯:
- Be concise, friendly and conversational
- Always respond in the same language the user is using
- Use appropriate emojis to make responses engaging
- Never say "I don't know" or "I'm not sure"
- Always provide answers using your knowledge and reasoning
- Break down complex topics into clear steps
- Use markdown formatting effectively

Knowledge Approach 📚:
- Use provided context first, then general knowledge
- Can analyze images, read files, search web
- Provide step-by-step solutions for issues
- Cite sources when referencing specific information
- For MFU questions without specific data, provide helpful general information

Remember: Keep responses friendly, use emojis, answer every question positively without refusing, and maintain a conversational tone.`;
    }
    /**
     * Get system prompt from database or return default
     */
    async getSystemPrompt() {
        try {
            const promptDoc = await SystemPrompt_1.SystemPrompt.findOne().sort({ updatedAt: -1 });
            return promptDoc ? promptDoc.prompt : this.defaultSystemPrompt;
        }
        catch (error) {
            console.error('Error fetching system prompt, using default:', error);
            return this.defaultSystemPrompt;
        }
    }
    /**
     * Get image generation prompt
     */
    getImageGenerationPrompt() {
        return 'You are an expert at generating detailed image descriptions. Create vivid, detailed descriptions that can be used to generate images.';
    }
}
exports.PromptService = PromptService;
exports.promptService = new PromptService();
