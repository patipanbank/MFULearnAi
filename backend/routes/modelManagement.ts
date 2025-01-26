import express from 'express';
import { OllamaManager } from '../services/ollamaManager';
import { roleGuard } from '../middleware/roleGuard';

const router = express.Router();
const ollamaManager = new OllamaManager();

// ดึงรายการ models (Staff only)
router.get('/models', roleGuard(['Staffs']), async (req, res) => {
  try {
    const models = await ollamaManager.listModels();
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// ดาวน์โหลด model ใหม่ (Staff only)
router.post('/models/pull', roleGuard(['Staffs']), async (req, res) => {
  try {
    const { modelName } = req.body;
    const result = await ollamaManager.pullModel(modelName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to pull model' });
  }
});

// ลบ model (Staff only)
router.delete('/models/:modelName', roleGuard(['Staffs']), async (req, res) => {
  try {
    const { modelName } = req.params;
    const result = await ollamaManager.deleteModel(modelName);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete model' });
  }
});

export default router; 