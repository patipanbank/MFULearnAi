import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { ChromaClient, Collection } from 'chromadb';
import axios from 'axios';
import pdf from 'pdf-parse';

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// --- Configuration ---
const PORT = process.env.PORT || 7000;
const ENV_TYPE = process.env.ENV_TYPE || 'TEST';
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
const BEDROCK_URL = process.env.BEDROCK_URL || 'http://localhost:5000/api/bedrock';

// --- Clients ---
const chroma = new ChromaClient({ path: CHROMA_URL });
const upload = multer({ storage: multer.memoryStorage() });

// --- Types ---
interface DocumentChunk {
    id: string;
    text: string;
    metadata: any;
}

// --- Helpers ---

// 1. Get or create Chroma collection
async function getCollection(): Promise<Collection> {
    const collectionName = `knowledge_base_${ENV_TYPE.toLowerCase()}`;
    return await chroma.getOrCreateCollection({
        name: collectionName,
        metadata: { "hnsw:space": "cosine" } // Use cosine similarity
    });
}

// 2. Generate Embedding via Bedrock Gateway
async function getEmbedding(text: string): Promise<number[]> {
    try {
        const response = await axios.post(`${BEDROCK_URL}/embeddings`, { text });
        if (response.data && response.data.embedding) {
            return response.data.embedding;
        }
        throw new Error('Invalid response from Bedrock');
    } catch (error: any) {
        console.error('[Knowledge] Embedding failed:', error.message);
        throw error;
    }
}

// 3. Chunk Text (Simple implementation)
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start += (chunkSize - overlap);
    }

    return chunks;
}

// --- Endpoints ---

// Health Check
app.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'ok',
        service: 'knowledge-service',
        environment: ENV_TYPE,
        chroma: CHROMA_URL
    });
});

// Upload Document (PDF/TXT)
app.post('/api/knowledge/upload', upload.single('file'), async (req: any, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    const { mimetype, buffer } = req.file;
    // Fix for non-standard filename encoding (like Thai)
    // Multer/Busboy often defaults to latin1, so we convert it back to buffer and then to utf8.
    const originalname = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    const userId = req.body.userId || 'system';

    try {
        console.log(`[Knowledge] Processing file: ${originalname} (${mimetype})`);

        // 1. Extract Text
        let text = '';
        if (mimetype === 'application/pdf') {
            const data = await pdf(buffer);
            text = data.text;
        } else if (mimetype === 'text/plain') {
            text = buffer.toString('utf-8');
        } else {
            return res.status(400).json({ error: 'Unsupported file type. Use PDF or TXT.' });
        }

        // Clean text
        text = text.replace(/\s+/g, ' ').trim();

        if (text.length === 0) {
            return res.status(400).json({ error: 'Extracted text is empty' });
        }

        // 2. Chunking
        const chunks = chunkText(text);
        console.log(`[Knowledge] Created ${chunks.length} chunks`);

        // 3. Generate Embeddings & Prepare for Chroma
        const ids: string[] = [];
        const embeddings: number[][] = [];
        const metadatas: any[] = [];
        const documents: string[] = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const embedding = await getEmbedding(chunk);

            ids.push(`${originalname}-${i}`);
            embeddings.push(embedding);
            documents.push(chunk);
            metadatas.push({
                source: originalname,
                chunkIndex: i,
                uploadedBy: userId,
                timestamp: Date.now()
            });
        }

        // 4. Store in Chroma
        const collection = await getCollection();
        await collection.add({
            ids,
            embeddings,
            metadatas,
            documents
        });

        console.log(`[Knowledge] Successfully indexed ${chunks.length} chunks for ${originalname}`);

        res.json({
            success: true,
            message: `Processed ${originalname}`,
            chunks: chunks.length
        });

    } catch (error: any) {
        console.error('[Knowledge] Upload error:', error);
        res.status(500).json({ error: error.message || 'Failed to process document' });
    }
});

// Search API (to be used by Orchestrator)
app.post('/api/knowledge/search', async (req: Request, res: Response) => {
    const { query, limit = 3 } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    try {
        // 1. Embed query
        const queryEmbedding = await getEmbedding(query);

        // 2. Search Chroma
        const collection = await getCollection();
        const results = await collection.query({
            queryEmbeddings: [queryEmbedding],
            nResults: limit
        });

        // Format results
        const documents = results.documents[0];
        const metadatas = results.metadatas[0];
        const distances = results.distances ? results.distances[0] : [];

        const hits = documents.map((doc, i) => ({
            content: doc,
            metadata: metadatas[i],
            score: distances[i] // Distance (lower is better for cosine usually, depends on implementation)
        }));

        res.json({ results: hits });

    } catch (error: any) {
        console.error('[Knowledge] Search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

// List Documents API
app.get('/api/knowledge/documents', async (req: Request, res: Response) => {
    try {
        const collection = await getCollection();
        // Chroma doesn't support "distinct" directly easily without fetching metadata.
        // We'll fetch all metadata (limit 1000 for now) and aggregate.
        // In a real prod app, you'd store file metadata in Mongo/Postgres.
        const result = await collection.get({
            limit: 1000,
            include: ["metadatas"] as any
        });

        const files = new Map();

        result.metadatas.forEach((meta: any) => {
            if (meta && meta.source) {
                if (!files.has(meta.source)) {
                    files.set(meta.source, {
                        name: meta.source,
                        uploadedBy: meta.uploadedBy,
                        timestamp: meta.timestamp,
                        chunks: 1
                    });
                } else {
                    const file = files.get(meta.source);
                    file.chunks++;
                }
            }
        });

        res.json({ documents: Array.from(files.values()) });

    } catch (error: any) {
        console.error('[Knowledge] List error:', error);
        res.status(500).json({ error: 'Failed to list documents' });
    }
});

// Reset Collection (Dev helper)
app.delete('/api/knowledge/reset', async (req: Request, res: Response) => {
    try {
        const collectionName = `knowledge_base_${ENV_TYPE.toLowerCase()}`;
        await chroma.deleteCollection({ name: collectionName });
        res.json({ success: true, message: 'Collection deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`[Knowledge Service] Running on port ${PORT} [Env: ${ENV_TYPE}]`);
});
