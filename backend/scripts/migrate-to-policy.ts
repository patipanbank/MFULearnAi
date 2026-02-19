
import mongoose from 'mongoose';
import { Knowledge } from '../src/knowledge/models';
import { ChromaClient } from 'chromadb';
import dotenv from 'dotenv';
import path from 'path';

// Hardcoded config matching init.ts
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000'; // Default local
const GLOBAL_CHROMA_COLLECTION = "mfulearnai-global-kb";

// Load Env
dotenv.config({ path: path.join(__dirname, '../.env') });

async function migrate() {
    console.log('--- Migration: Convert Files to Policy Type ---');

    // Connect Mongo
    await mongoose.connect(process.env.MONGODB_URI as string);
    console.log('Connected to MongoDB');

    // Connect Chroma
    const chroma = new ChromaClient({ path: CHROMA_URL });
    const collection = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION, embeddingFunction: null as any });
    console.log(`Connected to ChromaDB Collection: ${GLOBAL_CHROMA_COLLECTION}`);

    // Get Target Files (Change logic here)
    const targetFileNames = [
        'Tuition Regulation 2024.pdf',
        'Student Handbook.pdf'
    ];
    // OR migrate all from specific folder?
    // For now, let's ask user to edit this array.

    console.log(`Target Files: ${targetFileNames.join(', ')}`);

    for (const fileName of targetFileNames) {
        const kb = await Knowledge.findOne({
            $or: [{ title: fileName }, { contentSource: fileName }]
        });

        if (!kb) {
            console.log(`[SKIP] File not found in DB: ${fileName}`);
            continue;
        }

        console.log(`[PROCESSING] ${kb.title} (${kb._id})`);

        // 1. Update MongoDB
        kb.type = 'policy';
        kb.department = 'General'; // Policy is usually general
        await kb.save();
        console.log('  - Updated MongoDB type to "policy"');

        // 2. Update ChromaDB Metadata
        // We need to find all chunks for this file
        const results = await collection.get({
            where: { knowledgeId: kb._id.toString() }
        });

        if (results.ids.length > 0) {
            console.log(`  - Found ${results.ids.length} chunks in ChromaDB`);

            // Prepare update
            const newMetadatas = results.metadatas.map((m: any) => ({
                ...m,
                type: 'policy'
            }));

            await collection.update({
                ids: results.ids,
                metadatas: newMetadatas
            });
            console.log('  - Updated ChromaDB metadata');
        } else {
            console.log('  - No chunks found in ChromaDB (maybe strict match failed?)');
        }
    }

    console.log('--- Migration Completed ---');
    process.exit(0);
}

migrate().catch(e => {
    console.error(e);
    process.exit(1);
});
