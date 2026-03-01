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

const PORT = process.env.PORT || 5002;

const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'ap-southeast-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!
    }
});

const TITAN_IMAGE_MODEL = "amazon.titan-image-generator-v1";

// --- Middleware ---
const ENV_TYPE_IMG = process.env.ENV_TYPE || 'TEST';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || (ENV_TYPE_IMG === 'PROD' ? '' : 'internal-secret-key');

if (ENV_TYPE_IMG === 'PROD' && !INTERNAL_API_KEY) {
    console.error('[FATAL] INTERNAL_API_KEY is required in PROD environment');
    process.exit(1);
}

const authenticateInternal = (req: Request, res: Response, next: any) => {
    const key = req.headers['x-internal-key'];

    if (key !== INTERNAL_API_KEY) {
        console.warn(`[Bedrock Image] Unauthorized access attempt from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized: Internal Access Only' });
    }
    next();
};

app.use(authenticateInternal);

app.post('/api/bedrock/image', async (req: Request, res: Response) => {
    const { prompt } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const command = new InvokeModelCommand({
            modelId: TITAN_IMAGE_MODEL,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify({
                taskType: "TEXT_IMAGE",
                textToImageParams: {
                    text: prompt,
                    numberOfImages: 1,
                    imageHeight: 1024,
                    imageWidth: 1024,
                    cfgScale: 8.0,
                    seed: Math.floor(Math.random() * 1000000)
                },
                imageGenerationConfig: {
                    numberOfImages: 1,
                    quality: "standard",
                    height: 1024,
                    width: 1024,
                    cfgScale: 8.0
                }
            })
        });

        const response = await client.send(command);
        const decoded = new TextDecoder().decode(response.body);
        const data = JSON.parse(decoded);

        if (!data.images || !data.images[0]) {
            throw new Error("No image generated");
        }

        res.json({ success: true, image: data.images[0] });

    } catch (e: any) {
        console.error('[Bedrock Image] Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'bedrock-image' }));

app.listen(PORT, () => console.log(`[Bedrock Image] Running on ${PORT}`));
