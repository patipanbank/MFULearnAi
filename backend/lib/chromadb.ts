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
export const getOrCreateCollection = async () => {
    const collectionName = "mfu_knowledge";
    try {
        const collection = await client.getCollection({
            name: collectionName,
            embeddingFunction: localEmbeddingFunction
        });
        return collection;
    } catch {
        return await client.createCollection({
            name: collectionName,
            embeddingFunction: localEmbeddingFunction
        });
    }
}; 