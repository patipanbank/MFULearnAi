/**
 * Re-embed all Chroma data with Titan Embed v2.
 *
 * Why: Changing embedding model (v1→v2) means ALL vectors in Chroma
 * are in the wrong space. Old v1 vectors (1536 dims) cannot be mixed
 * with new v2 vectors (1024 dims). This script:
 *
 *   1. Reads all existing documents from Chroma
 *   2. Deletes the old collection
 *   3. Creates a new collection
 *   4. Re-embeds all documents using Titan Embed v2
 *   5. Re-inserts with original metadata preserved
 *
 * Run: node backend/scripts/reembedChroma.js
 * (from project root, loads .env automatically)
 *
 * ⚠ This is a DESTRUCTIVE operation — back up Chroma volume first if needed.
 * ⚠ For test/dev environments only — production should use a migration strategy.
 */

const fs = require('fs');
const path = require('path');

// Add node_modules to resolve path
if (module.paths) {
    module.paths.push(path.join(__dirname, '../../node_modules'));
}

const { ChromaClient } = require('chromadb');
const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");

// ── Load .env ──────────────────────────────────────────────────
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    console.log(`Loading env from: ${envPath}`);
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

// ── Configuration ──────────────────────────────────────────────
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const COLLECTION_NAME = 'mfulearnai-global-kb';
const TITAN_V2_MODEL = 'amazon.titan-embed-text-v2:0';
const TITAN_V2_DIMENSIONS = 1024;
const TITAN_V2_NORMALIZE = true;
const EMBEDDING_CONCURRENCY = 5;
const BATCH_SIZE = 100; // Chroma get() batch size

const region = process.env.AWS_REGION || 'us-east-1';
console.log(`Region: ${region}`);
console.log(`Chroma: ${CHROMA_URL}`);
console.log(`Collection: ${COLLECTION_NAME}`);
console.log(`Embedding: ${TITAN_V2_MODEL} (${TITAN_V2_DIMENSIONS} dims)\n`);

const bedrockClient = new BedrockRuntimeClient({
    region,
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    } : {})
});

const chroma = new ChromaClient({ path: CHROMA_URL });

// ── Embedding helper ──────────────────────────────────────────
async function embedText(text) {
    const command = new InvokeModelCommand({
        modelId: TITAN_V2_MODEL,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            inputText: text,
            dimensions: TITAN_V2_DIMENSIONS,
            normalize: TITAN_V2_NORMALIZE,
        }),
    });
    const response = await bedrockClient.send(command);
    const data = JSON.parse(new TextDecoder().decode(response.body));
    if (!data.embedding) throw new Error('No embedding in response');
    return data.embedding;
}

async function embedBatch(texts) {
    const results = new Array(texts.length);
    for (let i = 0; i < texts.length; i += EMBEDDING_CONCURRENCY) {
        const batch = texts.slice(i, i + EMBEDDING_CONCURRENCY);
        const batchResults = await Promise.all(batch.map(embedText));
        batchResults.forEach((vec, j) => { results[i + j] = vec; });
    }
    return results;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
    console.log('=== Re-embed Chroma with Titan Embed v2 ===\n');

    // 1. Connect & read all existing data
    let col;
    try {
        col = await chroma.getCollection({ name: COLLECTION_NAME, embeddingFunction: null });
    } catch (e) {
        console.log(`❌ Collection "${COLLECTION_NAME}" not found. Nothing to re-embed.`);
        return;
    }

    const count = await col.count();
    console.log(`📊 Found ${count} vectors in collection.`);

    if (count === 0) {
        console.log('Collection is empty. Nothing to do.');
        return;
    }

    // 2. Read all data in batches (Chroma limits get() to ~10K at a time)
    const allIds = [];
    const allDocuments = [];
    const allMetadatas = [];

    let offset = 0;
    while (offset < count) {
        const limit = Math.min(BATCH_SIZE, count - offset);
        const result = await col.get({
            limit,
            offset,
            include: ['documents', 'metadatas'],
        });
        allIds.push(...result.ids);
        allDocuments.push(...result.documents);
        allMetadatas.push(...result.metadatas);
        offset += result.ids.length;
        process.stdout.write(`\r  Read ${offset}/${count} documents...`);
    }
    console.log(`\n✅ Read ${allIds.length} documents.\n`);

    // 3. Delete old collection & create fresh
    console.log('🗑  Deleting old collection...');
    await chroma.deleteCollection({ name: COLLECTION_NAME });
    console.log('📦 Creating new collection (cosine)...');
    const newCol = await chroma.createCollection({
        name: COLLECTION_NAME,
        metadata: { 'hnsw:space': 'cosine' },
    });

    // 4. Re-embed & insert in batches
    const INSERT_BATCH = 50;
    let embedded = 0;
    let failed = 0;
    const startTime = Date.now();

    for (let i = 0; i < allIds.length; i += INSERT_BATCH) {
        const batchIds = allIds.slice(i, i + INSERT_BATCH);
        const batchDocs = allDocuments.slice(i, i + INSERT_BATCH);
        const batchMeta = allMetadatas.slice(i, i + INSERT_BATCH);

        // Filter out null/empty documents
        const validIndices = batchDocs.map((d, idx) => d ? idx : -1).filter(idx => idx >= 0);
        if (validIndices.length === 0) continue;

        const validDocs = validIndices.map(idx => batchDocs[idx]);
        const validIds = validIndices.map(idx => batchIds[idx]);
        const validMeta = validIndices.map(idx => batchMeta[idx]);

        try {
            const embeddings = await embedBatch(validDocs);

            await newCol.add({
                ids: validIds,
                embeddings,
                documents: validDocs,
                metadatas: validMeta,
            });

            embedded += validIds.length;
        } catch (err) {
            failed += validIndices.length;
            console.error(`\n❌ Batch ${i}-${i + INSERT_BATCH} failed: ${err.message}`);
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const rate = (embedded / parseFloat(elapsed) || 0).toFixed(1);
        process.stdout.write(
            `\r  Embedded: ${embedded}/${allIds.length} (${failed} failed) — ${elapsed}s — ${rate} docs/s`
        );
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n\n=== Done ===`);
    console.log(`✅ Re-embedded: ${embedded} documents`);
    console.log(`❌ Failed: ${failed} documents`);
    console.log(`⏱  Total time: ${totalTime}s`);
    console.log(`📐 New dimensions: ${TITAN_V2_DIMENSIONS}`);
    console.log(`🔧 Model: ${TITAN_V2_MODEL}`);

    // Verify
    const newCount = await newCol.count();
    console.log(`\n📊 New collection count: ${newCount}`);
}

main().catch(err => {
    console.error('\n💀 Fatal error:', err.message);
    process.exit(1);
});
