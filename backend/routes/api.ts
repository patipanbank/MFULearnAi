import express from 'express';
import multer from 'multer';
import { OllamaService } from '../services/ollama';
import { roleGuard } from '../middleware/roleGuard';

const router = express.Router();
const upload = multer();
const ollamaService = new OllamaService();

// ดึงรายการ models
router.get('/models', async (req, res) => {
  try {
    const models = await ollamaService.getModels();
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// สร้าง collection ใหม่ (เฉพาะ Staff)
router.post('/collections', roleGuard(['Staffs']), async (req, res) => {
  try {
    const { modelName, collectionName } = req.body;
    await ollamaService.createCollection(modelName, collectionName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

// Training endpoint (Staff only)
router.post('/train', 
  roleGuard(['Staffs']), 
  upload.single('file'),
  async (req, res) => {
    try {
      const { modelName, collectionName } = req.body;
      const file = req.file!;
      
      const result = await ollamaService.trainModel(
        file,
        modelName,
        collectionName
      );
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: 'Training failed' });
    }
});

// Query endpoint
router.post('/query', async (req, res) => {
  try {
    const { question, modelName, collectionName } = req.body;
    
    const response = await ollamaService.query(
      question,
      modelName,
      collectionName
    );
    
    res.json(response);
  } catch (error) {
    res.status(500).json({ error: 'Query failed' });
  }
});

export default router; 