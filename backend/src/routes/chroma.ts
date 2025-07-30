import express, { Request, Response } from 'express';
import { chromaService } from '../services/chromaService';

const router = express.Router();

// List all collections
router.get('/collections', async (req: Request, res: Response) => {
  try {
    const collections = await chromaService.listCollections();
    res.json(collections);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

// Create or get a collection
router.post('/collections/:name', async (req: Request, res: Response) => {
  try {
    const collection = await chromaService.getOrCreateCollection(req.params.name);
    res.json(collection);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

// Delete a collection
router.delete('/collections/:name', async (req: Request, res: Response) => {
  try {
    await chromaService.deleteCollection(req.params.name);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

// Add documents to a collection
router.post('/collections/:name/add', async (req: Request, res: Response) => {
  const { documents, embeddings, metadatas, ids } = req.body;
  try {
    const result = await chromaService.addToCollection(req.params.name, documents, embeddings, metadatas, ids);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

// Query a collection
router.post('/collections/:name/query', async (req: Request, res: Response) => {
  const { queryEmbeddings, nResults } = req.body;
  try {
    const result = await chromaService.queryCollection(req.params.name, queryEmbeddings, nResults);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

// Get documents from a collection
router.get('/collections/:name/documents', async (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;
  try {
    const result = await chromaService.getDocuments(req.params.name, limit, offset);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

// Delete documents by ids
router.post('/collections/:name/delete-documents', async (req: Request, res: Response) => {
  const { ids } = req.body;
  try {
    await chromaService.deleteDocuments(req.params.name, ids);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

export default router; 