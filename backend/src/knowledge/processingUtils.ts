import { BedrockEmbeddingService } from '../bedrock/embedding/index';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CHUNK_SIZE, CHUNK_OVERLAP } from './constants';

export async function getEmbedding(text: string): Promise<number[]> {
    return await BedrockEmbeddingService.getEmbedding(text);
}

/**
 * Get embeddings for multiple texts concurrently (with concurrency limit).
 * Significantly faster than sequential calls for large chunk sets.
 */
const EMBEDDING_CONCURRENCY = parseInt(process.env.KB_EMBEDDING_CONCURRENCY || '5', 10);

export async function getEmbeddingsBatch(
    texts: string[],
    onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
    const results: number[][] = new Array(texts.length);
    let completed = 0;

    // Process in concurrent batches
    for (let i = 0; i < texts.length; i += EMBEDDING_CONCURRENCY) {
        const batch = texts.slice(i, i + EMBEDDING_CONCURRENCY);
        const batchResults = await Promise.all(
            batch.map(text => getEmbedding(text))
        );
        batchResults.forEach((vec, j) => {
            results[i + j] = vec;
        });
        completed += batch.length;
        if (onProgress) onProgress(completed, texts.length);
    }

    return results;
}

export async function chunkText(text: string, options?: { chunkSize?: number, chunkOverlap?: number }): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: options?.chunkSize || CHUNK_SIZE,
        chunkOverlap: options?.chunkOverlap || CHUNK_OVERLAP,
        separators: ["\n\n", "\n", ".", " ", ""], // Paragraph > Line > Sentence > Word > Char
    });
    return await splitter.splitText(text);
}
