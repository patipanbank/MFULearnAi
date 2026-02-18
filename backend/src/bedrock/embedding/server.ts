import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import fs from 'fs';
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
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing Bearer Token' });
    }

    const token = authHeader.split(' ')[1];
    const fs = require('fs');
    const PUBLIC_KEY_PATH = process.env.JWT_PUBLIC_KEY_PATH || '/run/secrets/jwt_public_key';

    try {
        if (!fs.existsSync(PUBLIC_KEY_PATH)) {
            console.error('[Bedrock] Missing Public Key File');
            return res.status(500).json({ error: 'Server Configuration Error' });
        }
        const publicKey = fs.readFileSync(PUBLIC_KEY_PATH);
        const decoded: any = jwt.verify(token, publicKey, { algorithms: ['RS256'] });

        // STRICT VERIFICATION
        if (decoded.aud !== 'mfu-bedrock-service') throw new Error('Invalid Audience');
        if (decoded.typ !== 'internal-jwt') throw new Error('Invalid Token Type');
        // if (!decoded.scope.includes('internal:read')) ... (Optional granularity)

        // Pass
        next();
    } catch (e: any) {
        console.warn(`[Bedrock] Auth Failed: ${e.message}`);
        return res.status(403).json({ error: 'Forbidden' });
    }
};

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'bedrock-embedding' }));

// Protect API
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

app.listen(PORT, () => console.log(`[Bedrock Embedding] Running on ${PORT}`));
