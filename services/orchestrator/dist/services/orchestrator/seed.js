"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedPrompts = void 0;
const Prompt_1 = __importDefault(require("./models/Prompt"));
const systemPrompts_1 = require("./systemPrompts");
const seedPrompts = async () => {
    console.log('[Orchestrator] Checking System Prompts...');
    const promptsToSeed = [
        {
            key: 'DINDINAI_SYSTEM_PROMPT',
            name: 'DinDin AI (Production)',
            description: 'Official production system prompt for DinDin AI',
            content: systemPrompts_1.DINDINAI_SYSTEM_PROMPT,
            tags: ['PROD'],
            type: 'core'
        },
        {
            key: 'MFULEARNAI_SYSTEM_PROMPT',
            name: 'MFULearnAI (Test)',
            description: 'Experimental system prompt for MFULearnAI test environment',
            content: systemPrompts_1.MFULEARNAI_SYSTEM_PROMPT,
            tags: ['TEST'],
            type: 'core'
        }
    ];
    for (const p of promptsToSeed) {
        try {
            const existing = await Prompt_1.default.findOne({ key: p.key });
            if (!existing) {
                console.log(`[Orchestrator] Seeding prompt: ${p.key}`);
                const newPrompt = new Prompt_1.default({
                    key: p.key,
                    type: p.type,
                    name: p.name,
                    description: p.description,
                    isPublic: true, // Core prompts generally visible to admins
                    isActive: true,
                    tags: p.tags,
                    ownerId: null, // System owned
                    activeVersion: 1,
                    versions: [{
                            version: 1,
                            content: p.content,
                            changelog: 'Initial Seed',
                            createdBy: 'system',
                            createdAt: new Date(),
                            variables: []
                        }]
                });
                await newPrompt.save();
                console.log(`[Orchestrator] Seeded ${p.key} successfully.`);
            }
            else {
                // Optional: Check if we should update? 
                // For now, respect existing data as user might have edited it via Admin UI.
                // console.log(`[Orchestrator] Prompt ${p.key} already exists. Skipping.`);
            }
        }
        catch (error) {
            console.error(`[Orchestrator] Failed to seed ${p.key}:`, error);
        }
    }
};
exports.seedPrompts = seedPrompts;
