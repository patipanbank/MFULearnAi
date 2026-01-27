
import mongoose from 'mongoose';
import Prompt from './models/Prompt';
import dotenv from 'dotenv';
import { getSystemPrompt } from './systemPrompts';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mful-chat';
const ENV_TYPE = (process.env.ENV_TYPE || 'TEST') as 'TEST' | 'PROD';

const debugPrompts = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log(`Connected to DB: ${MONGO_URI}`);
        console.log(`ENV_TYPE: ${ENV_TYPE}`);

        // Simulate getCoreSystemPrompt logic
        const fallbackKey = ENV_TYPE === 'PROD' ? 'DINDINAI_SYSTEM_PROMPT' : 'MFULEARNAI_SYSTEM_PROMPT';
        console.log(`Looking for Core Prompt with: type='core', isActive=true, key='${fallbackKey}' OR tags='${ENV_TYPE}'`);

        const promptDoc = await Prompt.findOne({
            type: 'core',
            isActive: true,
            $or: [{ key: fallbackKey }, { tags: ENV_TYPE }]
        });

        if (promptDoc) {
            console.log('✅ FOUND Core Prompt in DB:');
            console.log(`   ID: ${promptDoc._id}`);
            console.log(`   Key: ${promptDoc.key}`);
            console.log(`   Active Version: ${promptDoc.activeVersion}`);
            const content = promptDoc.versions.find(v => v.version === promptDoc.activeVersion)?.content;
            console.log(`   Content Length: ${content?.length}`);
            console.log(`   Snippet: ${content?.substring(0, 50)}...`);
        } else {
            console.log('❌ NOT FOUND in DB. Fallback to Hardcoded:');
            const fallback = getSystemPrompt(ENV_TYPE);
            console.log(`   Fallback Content Length: ${fallback.length}`);
        }

        // List ALL active core prompts to check for duplicates
        const allActive = await Prompt.find({ type: 'core', isActive: true });
        console.log(`\nTotal Active Core Prompts: ${allActive.length}`);
        allActive.forEach(p => console.log(`   - ${p.key} [${p.tags.join(',')}]`));

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
    }
};

debugPrompts();
