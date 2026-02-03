import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const BEDROCK_EMBEDDING_URL = process.env.BEDROCK_EMBEDDING_URL || 'http://localhost:5003/api/bedrock';

export async function getEmbedding(text: string): Promise<number[]> {
    try {
        const response = await axios.post(`${BEDROCK_EMBEDDING_URL}/embeddings`, { text });
        if (response.data && response.data.embedding) return response.data.embedding;
        throw new Error('Invalid Bedrock response');
    } catch (e: any) {
        console.error('Embedding failed:', e.message);
        throw e;
    }
}

export function chunkText(text: string): string[] {
    const chunkSize = 1000, overlap = 200;
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start += (chunkSize - overlap);
    }
    return chunks;
}
