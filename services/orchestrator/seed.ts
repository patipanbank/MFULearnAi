import Prompt, { IPrompt } from './models/Prompt';
import { DINDINAI_SYSTEM_PROMPT, MFULEARNAI_SYSTEM_PROMPT } from './systemPrompts';

export const seedPrompts = async () => {
    console.log('[Orchestrator] Checking System Prompts...');

    const promptsToSeed = [
        {
            key: 'DINDINAI_SYSTEM_PROMPT',
            name: 'DinDin AI (Production)',
            description: 'Official production system prompt for DinDin AI',
            content: DINDINAI_SYSTEM_PROMPT,
            tags: ['PROD'],
            type: 'core'
        },
        {
            key: 'MFULEARNAI_SYSTEM_PROMPT',
            name: 'MFULearnAI (Test)',
            description: 'Experimental system prompt for MFULearnAI test environment',
            content: MFULEARNAI_SYSTEM_PROMPT,
            tags: ['TEST'],
            type: 'core'
        }
    ];

    for (const p of promptsToSeed) {
        try {
            const existing = await Prompt.findOne({ key: p.key });
            if (!existing) {
                console.log(`[Orchestrator] Seeding prompt: ${p.key}`);
                const newPrompt = new Prompt({
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
            } else {
                // Optional: Check if we should update? 
                // For now, respect existing data as user might have edited it via Admin UI.
                // console.log(`[Orchestrator] Prompt ${p.key} already exists. Skipping.`);
            }
        } catch (error) {
            console.error(`[Orchestrator] Failed to seed ${p.key}:`, error);
        }
    }
};
