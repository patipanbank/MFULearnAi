import { initMinio } from './minioClient';
import { initWorker } from './queue';
import { ChromaClient } from 'chromadb';
import { Collection } from './models';
import { LoggerService } from '../services/LoggerService';
import { CHROMA_URL, GLOBAL_CHROMA_COLLECTION } from './constants';

const chroma = new ChromaClient({ path: CHROMA_URL });

export async function initKnowledgeConfig() {
    LoggerService.info('knowledge_init_start', {});

    // Init MinIO
    await initMinio();

    // Init Worker
    initWorker();

    // Init Chroma
    try {
        await chroma.getOrCreateCollection({ name: GLOBAL_CHROMA_COLLECTION, metadata: { "hnsw:space": "cosine" } });
        LoggerService.info('knowledge_chroma_initialized', { collection: GLOBAL_CHROMA_COLLECTION });
    } catch (e: any) {
        LoggerService.error('knowledge_chroma_init_failed', { error: e.message });
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
            LoggerService.info('knowledge_default_collection_created', {});
        }
    } catch (e: any) {
        LoggerService.error('knowledge_default_col_init_failed', { error: e.message });
    }
}
