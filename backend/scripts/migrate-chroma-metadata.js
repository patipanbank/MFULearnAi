/**
 * Migration Script: Backfill `type` and `fileName` metadata in ChromaDB chunks.
 * 
 * Problem: Chunks in ChromaDB were originally stored without the Knowledge document's
 * `type` field (e.g., 'policy', 'personal', 'department', 'public'). This means
 * PolicyService's `{ type: 'policy' }` filter and SearchTool's `{ type: { $ne: 'policy' } }`
 * filter both had broken semantics.
 * 
 * Solution: Query MongoDB for all Knowledge documents, then update their corresponding
 * ChromaDB chunks to include the `type` and `fileName` metadata fields.
 * 
 * Usage: node scripts/migrate-chroma-metadata.js
 * 
 * Prerequisites:
 *   - MongoDB must be accessible (MONGODB_URI env var)
 *   - ChromaDB must be accessible (CHROMA_URL env var)
 */

const path = require('path');

// Load .env from backend root
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const mongoose = require('mongoose');
const { ChromaClient } = require('chromadb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mfulearnai';
const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
const GLOBAL_CHROMA_COLLECTION = 'mfulearnai-global-kb';

async function migrate() {
    console.log('[Migration] Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('[Migration] Connected to MongoDB.');

    // Define minimal Knowledge schema for query
    const KnowledgeSchema = new mongoose.Schema({
        title: String,
        type: String,
        contentSource: String,
        processingStatus: String
    }, { timestamps: true, collection: 'knowledges' });

    const Knowledge = mongoose.models.Knowledge || mongoose.model('Knowledge', KnowledgeSchema);

    console.log('[Migration] Connecting to ChromaDB...');
    const chroma = new ChromaClient({ path: CHROMA_URL });
    const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION });
    console.log('[Migration] Connected to ChromaDB.');

    // 1. Get all Knowledge docs
    const allKnowledge = await Knowledge.find({ processingStatus: 'completed' });
    console.log(`[Migration] Found ${allKnowledge.length} completed Knowledge documents.`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const kb of allKnowledge) {
        const knowledgeId = kb._id.toString();
        const type = kb.type || 'personal';
        const fileName = kb.contentSource || kb.title || 'unknown';

        try {
            // 2. Get all chunks for this knowledge document
            const existing = await col.get({
                where: { knowledgeId: knowledgeId }
            });

            if (!existing.ids || existing.ids.length === 0) {
                console.log(`  [SKIP] ${knowledgeId} (${fileName}) — no chunks in ChromaDB`);
                skipped++;
                continue;
            }

            // 3. Check if first chunk already has `type` metadata
            const firstMeta = existing.metadatas?.[0];
            if (firstMeta?.type) {
                console.log(`  [SKIP] ${knowledgeId} (${fileName}) — already has type='${firstMeta.type}' (${existing.ids.length} chunks)`);
                skipped++;
                continue;
            }

            // 4. Update metadata for all chunks
            const updatedMetadatas = existing.metadatas.map(meta => ({
                ...meta,
                type: type,
                fileName: fileName
            }));

            await col.update({
                ids: existing.ids,
                metadatas: updatedMetadatas
            });

            console.log(`  [OK] ${knowledgeId} (${fileName}) — updated ${existing.ids.length} chunks with type='${type}'`);
            updated++;

        } catch (err) {
            console.error(`  [ERROR] ${knowledgeId} (${fileName}):`, err.message);
            errors++;
        }
    }

    console.log(`\n[Migration] Complete!`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Errors:  ${errors}`);

    await mongoose.disconnect();
    process.exit(0);
}

migrate().catch(err => {
    console.error('[Migration] Fatal error:', err);
    process.exit(1);
});
