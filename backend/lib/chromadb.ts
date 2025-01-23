import { ChromaClient, IEmbeddingFunction } from 'chromadb';
import { generateEmbedding } from './embeddings.js';

const client = new ChromaClient({
  path: "http://chromadb:8000"
});

// Custom embedding function
const localEmbeddingFunction: IEmbeddingFunction = {
    generate: async (texts: string[]): Promise<number[][]> => {
        const embeddings = await Promise.all(
            texts.map(text => generateEmbedding(text))
        );
        return embeddings;
    }
};

// สร้าง collection สำหรับเก็บ vectors
export async function getOrCreateCollection() {
    console.log('Connecting to ChromaDB...');
    const client = new ChromaClient({
        path: "http://chromadb:8000"
    });

    const collectionName = 'mfu_knowledge';
    console.log(`Getting collection: ${collectionName}`);

    try {
        const collection = await client.getOrCreateCollection({
            name: collectionName,
            embeddingFunction: localEmbeddingFunction
        });
        console.log('Successfully got/created collection');
        return collection;
    } catch (error) {
        console.error('Error in getOrCreateCollection:', error);
        throw error;
    }
} 