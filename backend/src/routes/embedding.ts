import express, { Request, Response } from 'express';
import { embeddingService } from '../services/embeddingService';
import { usageService } from '../services/usageService';
import { authenticateJWT, AuthenticatedRequest } from '../middleware/auth';

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

router.post('/embedding', authenticateJWT, async (req: AuthenticatedRequest, res: Response) => {
  const body: EmbeddingRequest = req.body;
  try {
    const embeddings = await embeddingService.getTextEmbeddings(body.input, body.model);
    
    // Track token usage for embeddings (rough estimate: 1 token per 4 characters)
    if (req.user?.sub) {
      const totalChars = body.input.join('').length;
      const estimatedTokens = Math.ceil(totalChars / 4);
      await usageService.updateUsage(req.user.sub, estimatedTokens, 0);
    }
    
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