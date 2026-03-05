/**
 * ⚠ DESTRUCTIVE: Delete ALL knowledge data from the system.
 *
 * This script removes knowledge from all 3 storage layers:
 *   1. MongoDB  — Knowledge, Collection, KnowledgeHit documents
 *   2. ChromaDB — Vector embeddings (mfulearnai-global-kb collection)
 *   3. MinIO    — Uploaded files (mfulearnai-knowledge bucket)
 *
 * Usage:
 *   node backend/scripts/deleteAllKnowledge.js
 *
 * Environment variables (loaded from .env automatically):
 *   MONGODB_URI   — MongoDB connection string
 *   CHROMA_URL    — ChromaDB endpoint (default: http://localhost:8000)
 *   MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY, MINIO_BUCKET
 *
 * ⚠ THIS IS IRREVERSIBLE — back up your data first!
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Ensure node_modules resolve from project root
if (module.paths) {
    module.paths.push(path.join(__dirname, '../../node_modules'));
    module.paths.push(path.join(__dirname, '../node_modules'));
}

// ── Load .env ──
const envPath = path.join(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.\-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
            if (!process.env[key]) process.env[key] = value;
        }
    });
}

const mongoose = require('mongoose');
const { ChromaClient } = require('chromadb');
const Minio = require('minio');

// ── Config ──
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mfulearnai';
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const COLLECTION_NAME = 'mfulearnai-global-kb';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'mfulearnai-knowledge';

// ── Confirm prompt ──
function confirm(message) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(message, answer => {
            rl.close();
            resolve(answer.trim().toLowerCase());
        });
    });
}

// ── Step 1: MongoDB ──
async function clearMongoDB() {
    console.log('\n── [1/3] MongoDB ──');
    console.log(`Connecting to: ${MONGODB_URI.replace(/\/\/.*@/, '//***@')}`);

    await mongoose.connect(MONGODB_URI);

    const db = mongoose.connection.db;

    // Drop Knowledge documents
    const knowledgeResult = await db.collection('knowledges').deleteMany({});
    console.log(`  ✓ Deleted ${knowledgeResult.deletedCount} Knowledge document(s)`);

    // Drop Collection documents
    const collectionResult = await db.collection('collections').deleteMany({});
    console.log(`  ✓ Deleted ${collectionResult.deletedCount} Collection document(s)`);

    // Drop KnowledgeHit logs
    try {
        const hitResult = await db.collection('knowledgehits').deleteMany({});
        console.log(`  ✓ Deleted ${hitResult.deletedCount} KnowledgeHit log(s)`);
    } catch (e) {
        console.log(`  ⚠ KnowledgeHit collection not found — skipped`);
    }

    await mongoose.disconnect();
    console.log('  ✓ MongoDB cleanup complete');
}

// ── Step 2: ChromaDB ──
async function clearChroma() {
    console.log('\n── [2/3] ChromaDB ──');
    console.log(`Connecting to: ${CHROMA_URL}`);

    const chroma = new ChromaClient({ path: CHROMA_URL });

    // List collections
    const collections = await chroma.listCollections();
    console.log(`  Found ${collections.length} collection(s):`, collections.map(c => c.name || c));

    // Delete target collection
    try {
        await chroma.deleteCollection({ name: COLLECTION_NAME });
        console.log(`  ✓ Deleted collection "${COLLECTION_NAME}"`);
    } catch (e) {
        console.log(`  ⚠ Collection "${COLLECTION_NAME}" not found — skipped`);
    }

    // Recreate empty collection with cosine distance
    await chroma.createCollection({
        name: COLLECTION_NAME,
        metadata: { 'hnsw:space': 'cosine' },
    });
    console.log(`  ✓ Recreated empty "${COLLECTION_NAME}" (cosine distance)`);
}

// ── Step 3: MinIO ──
async function clearMinIO() {
    console.log('\n── [3/3] MinIO ──');
    console.log(`Connecting to: ${MINIO_ENDPOINT}:${MINIO_PORT}, bucket: ${MINIO_BUCKET}`);

    const minioClient = new Minio.Client({
        endPoint: MINIO_ENDPOINT,
        port: MINIO_PORT,
        useSSL: MINIO_USE_SSL,
        accessKey: MINIO_ACCESS_KEY,
        secretKey: MINIO_SECRET_KEY,
    });

    const bucketExists = await minioClient.bucketExists(MINIO_BUCKET);
    if (!bucketExists) {
        console.log(`  ⚠ Bucket "${MINIO_BUCKET}" does not exist — skipped`);
        return;
    }

    // List and delete all objects
    const objects = [];
    const stream = minioClient.listObjectsV2(MINIO_BUCKET, '', true);

    await new Promise((resolve, reject) => {
        stream.on('data', obj => objects.push(obj.name));
        stream.on('error', reject);
        stream.on('end', resolve);
    });

    if (objects.length === 0) {
        console.log(`  ⚠ Bucket "${MINIO_BUCKET}" is already empty`);
        return;
    }

    await minioClient.removeObjects(MINIO_BUCKET, objects);
    console.log(`  ✓ Deleted ${objects.length} file(s) from bucket "${MINIO_BUCKET}"`);
}

// ── Main ──
async function main() {
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║  ⚠  DELETE ALL KNOWLEDGE — IRREVERSIBLE  ⚠  ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
    console.log('This will permanently delete ALL knowledge data from:');
    console.log('  • MongoDB  (Knowledge, Collection, KnowledgeHit)');
    console.log('  • ChromaDB (vector embeddings)');
    console.log('  • MinIO    (uploaded files)');
    console.log('');

    const answer = await confirm('Type "yes" to confirm deletion: ');
    if (answer !== 'yes') {
        console.log('Aborted.');
        process.exit(0);
    }

    console.log('\n🔥 Starting deletion...\n');

    try {
        await clearMongoDB();
    } catch (err) {
        console.error('  ✗ MongoDB error:', err.message);
    }

    try {
        await clearChroma();
    } catch (err) {
        console.error('  ✗ ChromaDB error:', err.message);
    }

    try {
        await clearMinIO();
    } catch (err) {
        console.error('  ✗ MinIO error:', err.message);
    }

    console.log('\n════════════════════════════════════════════════');
    console.log('✅ All knowledge data has been deleted.');
    console.log('════════════════════════════════════════════════\n');

    process.exit(0);
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
