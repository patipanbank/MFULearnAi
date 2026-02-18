import { BedrockEmbeddingService } from '../bedrock/embedding/index';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export async function getEmbedding(text: string): Promise<number[]> {
    return await BedrockEmbeddingService.getEmbedding(text);
}

export async function chunkText(text: string): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        separators: ["\n\n", "\n", ".", " ", ""], // Paragraph > Line > Sentence > Word > Char
    });
    return await splitter.splitText(text);
}
