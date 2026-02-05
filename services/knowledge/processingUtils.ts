import axios from 'axios';
import dotenv from 'dotenv';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

dotenv.config();

const BEDROCK_EMBEDDING_URL = process.env.BEDROCK_EMBEDDING_URL || 'http://localhost:5003/api/bedrock';

import { TokenUtil } from './tokenUtils';

export async function getEmbedding(text: string): Promise<number[]> {
    try {
        // MINT SHORT-LIVED TOKEN
        const token = TokenUtil.mint('mfu-bedrock-service');

        const response = await axios.post(`${BEDROCK_EMBEDDING_URL}/embeddings`, { text }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
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
