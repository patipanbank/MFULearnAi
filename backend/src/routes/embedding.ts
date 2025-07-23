import express, { Request, Response } from 'express';
import { embeddingService } from '../services/embeddingService';

const router = express.Router();

interface EmbeddingRequest {
  input: string[];
  model?: string;
}
interface EmbeddingData {
  object: string;
  embedding: number[];
  index: number;
}
interface EmbeddingResponse {
  object: string;
  data: EmbeddingData[];
  model: string;
}

router.post('/embedding', async (req: Request, res: Response) => {
  const body: EmbeddingRequest = req.body;
  try {
    const embeddings = await embeddingService.getTextEmbeddings(body.input, body.model);
    const data: EmbeddingData[] = embeddings.map((emb, i) => ({
      object: 'embedding',
      embedding: emb,
      index: i,
    }));
    const response: EmbeddingResponse = {
      object: 'list',
      data,
      model: body.model || 'amazon.titan-embed-text-v1',
    };
    res.json(response);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

export default router; 