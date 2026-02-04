import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {
    BedrockRuntimeClient,
    InvokeModelCommand
} from "@aws-sdk/client-bedrock-runtime";

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());

const PORT = process.env.PORT || 5003;

const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'ap-southeast-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
});

const TITAN_EMBED_MODEL = "amazon.titan-embed-text-v1";

// --- Middleware ---
const authenticateInternal = (req: Request, res: Response, next: any) => {
    const key = req.headers['x-internal-key'];
    const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'internal-secret-key';

    if (key !== INTERNAL_API_KEY) {
        console.warn(`[Bedrock Embedding] Unauthorized access attempt from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized: Internal Access Only' });
    }
    next();
};

app.use(authenticateInternal);

app.post('/api/bedrock/embeddings', async (req: Request, res: Response) => {
    const { text } = req.body;

    if (!text) return res.status(400).json({ error: 'Text is required' });

    try {
        const command = new InvokeModelCommand({
            modelId: TITAN_EMBED_MODEL,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                inputText: text
            })
        });

        const response = await client.send(command);
        const decoded = new TextDecoder().decode(response.body);
        const data = JSON.parse(decoded);

        if (!data.embedding) throw new Error("No embedding generated");

        res.json({ success: true, embedding: data.embedding });

    } catch (e: any) {
        console.error('[Bedrock Embed] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'bedrock-embedding' }));

app.listen(PORT, () => console.log(`[Bedrock Embedding] Running on ${PORT}`));
