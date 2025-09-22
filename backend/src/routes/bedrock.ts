import express, { Request, Response } from 'express';
import { bedrockService } from '../services/bedrockService';

const router = express.Router();

// === Schemas (TypeScript interfaces) ===
interface BedrockMessage {
  role: string;
  content: string;
}

interface ConverseStreamRequest {
  messages: BedrockMessage[];
  system_prompt?: string;
  model_id?: string;
  tool_config?: any;
  temperature?: number;
  top_p?: number;
}

interface ImageGenerationRequest {
  prompt: string;
}

interface TextEmbeddingRequest {
  text: string;
}
interface BatchTextEmbeddingRequest {
  texts: string[];
}
interface ImageEmbeddingRequest {
  imageBase64: string;
  text?: string;
}

// === Endpoints ===

// POST /api/bedrock/converse-stream (mock streaming)
router.post('/converse-stream', async (req: Request, res: Response) => {
  const body: ConverseStreamRequest = req.body;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const modelId = body.model_id || 'anthropic.claude-3-5-sonnet-20240620-v1:0';
    const messages = body.messages || [];
    const systemPrompt = body.system_prompt || '';
    const toolConfig = body.tool_config;
    const temperature = body.temperature;
    const topP = body.top_p;

    for await (const event of bedrockService.converseStream(
      modelId,
      messages,
      systemPrompt,
      toolConfig,
      temperature,
      topP
    )) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    res.end();
    return; // Explicitly return to satisfy TypeScript
  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ error: error.message || 'Unknown error' })}\n\n`);
    res.end();
    return; // Explicitly return to satisfy TypeScript
  }
});

// POST /api/bedrock/generate-image
router.post('/generate-image', async (req: Request, res: Response) => {
  const body: ImageGenerationRequest = req.body;
  try {
    const image = await bedrockService.generateImage(body.prompt);
    if (!image) {
      res.status(500).json({ error: 'No image returned from Bedrock' });
      return null;
    }
    res.json({ image });
    return null;
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unknown error' });
    return null;
  }
});

// POST /api/bedrock/text-embedding
router.post('/text-embedding', async (req: Request, res: Response) => {
  const body: TextEmbeddingRequest = req.body;
  try {
    const embedding = await bedrockService.createTextEmbedding(body.text);
    res.json({ embedding });
    return null;
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unknown error' });
    return null;
  }
});

// POST /api/bedrock/batch-text-embedding
router.post('/batch-text-embedding', async (req: Request, res: Response) => {
  const body: BatchTextEmbeddingRequest = req.body;
  try {
    const embeddings = await bedrockService.createBatchTextEmbeddings(body.texts);
    res.json({ embeddings });
    return null;
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unknown error' });
    return null;
  }
});

// POST /api/bedrock/image-embedding
router.post('/image-embedding', async (req: Request, res: Response) => {
  const body: ImageEmbeddingRequest = req.body;
  try {
    const embedding = await bedrockService.createImageEmbedding(body.imageBase64, body.text);
    res.json({ embedding });
    return null;
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unknown error' });
    return null;
  }
});

export default router; 