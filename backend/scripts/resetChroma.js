/**
 * Reset Chroma — Delete collection and recreate empty for Titan Embed v2.
 * Run: CHROMA_URL=http://localhost:8001 node backend/scripts/resetChroma.js
 */

const fs = require('fs');
const path = require('path');

if (module.paths) {
    module.paths.push(path.join(__dirname, '../../node_modules'));
}

const { ChromaClient } = require('chromadb');

// Load .env
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w\.\-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (!process.env[key]) process.env[key] = value;
        }
    });
}

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8001';
const COLLECTION_NAME = 'mfulearnai-global-kb';

async function main() {
    console.log(`Chroma: ${CHROMA_URL}`);
    const chroma = new ChromaClient({ path: CHROMA_URL });

    // List all collections
    const collections = await chroma.listCollections();
    console.log(`Found ${collections.length} collection(s):`, collections.map(c => c.name || c));

    // Delete target collection
    try {
        await chroma.deleteCollection({ name: COLLECTION_NAME });
        console.log(`🗑  Deleted "${COLLECTION_NAME}"`);
    } catch (e) {
        console.log(`⚠ "${COLLECTION_NAME}" not found — skipping delete`);
    }

    // Recreate empty with cosine distance
    await chroma.createCollection({
        name: COLLECTION_NAME,
        metadata: { 'hnsw:space': 'cosine' },
    });
    console.log(`✅ Created fresh "${COLLECTION_NAME}" (cosine, ready for 1024-dim Titan v2)`);
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
