import express from 'express';
import axios from 'axios';
import { roleGuard } from '../middleware/roleGuard';
import AIModel from '../models/AIModel';

const router = express.Router();

// Get all models
router.get('/', async (req, res) => {
  try {
    // เรียกใช้ Ollama API เพื่อดึงรายการ models
    const response = await axios.get('http://ollama:11434/api/list');
    
    // แปลงข้อมูลให้อยู่ในรูปแบบที่ต้องการ
    const models = response.data.models.map((model: any) => ({
      name: model.name,
      modelType: model.name.split(':')[0], // แยกเอาชื่อ model จาก tag
      modified: model.modified,
      size: model.size
    }));

    res.json(models);
  } catch (error) {
    console.error('Error fetching models from Ollama:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching models',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create new model
router.post('/', roleGuard(['Staffs']), async (req, res) => {
  try {
    const { displayName, description, modelType } = req.body;
    const model = await AIModel.create({
      name: `model_${Date.now()}`,
      displayName,
      description,
      modelType
    });
    res.json(model);
  } catch (error) {
    res.status(500).json({ message: 'Error creating model', error });
  }
});

export default router; 