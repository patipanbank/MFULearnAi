import { BedrockEmbeddingService } from '../bedrock/embedding/index';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { CHUNK_SIZE, CHUNK_OVERLAP } from './constants';

export async function getEmbedding(text: string): Promise<number[]> {
    return await BedrockEmbeddingService.getEmbedding(text);
}

export async function chunkText(text: string, options?: { chunkSize?: number, chunkOverlap?: number }): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: options?.chunkSize || CHUNK_SIZE,
        chunkOverlap: options?.chunkOverlap || CHUNK_OVERLAP,
        separators: ["\n\n", "\n", ".", " ", ""], // Paragraph > Line > Sentence > Word > Char
    });
    return await splitter.splitText(text);
}
