import { initMinio } from './minioClient';
import { initWorker } from './queue';
import { ChromaClient } from 'chromadb';
import { Collection } from './models';

const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
const chroma = new ChromaClient({ path: CHROMA_URL });
const GLOBAL_CHROMA_COLLECTION = "mfulearnai-global-kb";

export async function initKnowledgeConfig() {
    console.log('[Knowledge] Initializing...');

    // Init MinIO
    await initMinio();

    // Init Worker
    initWorker();

    // Init Chroma
    try {
        await chroma.getOrCreateCollection({ name: GLOBAL_CHROMA_COLLECTION, metadata: { "hnsw:space": "cosine" } });
        console.log(`[Knowledge] Global Chroma collection initialized: ${GLOBAL_CHROMA_COLLECTION}`);
    } catch (e) {
        console.error('[Knowledge] Chroma init failed:', e);
    }

    // Init Default Collection
    try {
        const existing = await Collection.findOne({ isDefault: true });
        if (!existing) {
            await Collection.create({
                name: 'Default Collection',
                description: 'General knowledge base available to everyone.',
                type: 'default',
                ownerId: 'system',
                department: 'Global',
                isDefault: true,
                knowledgeIds: []
            });
            console.log('[Knowledge] Default Collection created.');
        }
    } catch (e) {
        console.error('[Knowledge] Default Col init failed:', e);
    }
}
