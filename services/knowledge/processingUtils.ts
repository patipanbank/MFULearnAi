import axios from 'axios';
import dotenv from 'dotenv';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

dotenv.config();

const BEDROCK_EMBEDDING_URL = process.env.BEDROCK_EMBEDDING_URL || 'http://localhost:5003/api/bedrock';

export async function getEmbedding(text: string): Promise<number[]> {
    try {
        const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-key';
        const response = await axios.post(`${BEDROCK_EMBEDDING_URL}/embeddings`, { text }, {
            headers: { 'x-internal-key': INTERNAL_API_KEY }
        });
        if (response.data && response.data.embedding) return response.data.embedding;
        throw new Error('Invalid Bedrock response');
    } catch (e: any) {
        console.error('Embedding failed:', e.message);
        throw e;
    }
}

export async function chunkText(text: string): Promise<string[]> {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
        separators: ["\n\n", "\n", ".", " ", ""], // Paragraph > Line > Sentence > Word > Char
    });
    return await splitter.splitText(text);
}
