import express, { RequestHandler } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import KnowledgeBase from '../models/KnowledgeBase';
import AIModel from '../models/AIModel';

const router = express.Router();

// Get all knowledge bases
router.get('/', async (req, res) => {
  try {
    const knowledgeBases = await KnowledgeBase.find();
    res.json(knowledgeBases);
  } catch (error) {
    console.error('Error fetching knowledge bases:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching knowledge bases',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get knowledge bases by model ID
router.get('/by-model/:modelId', async (req, res) => {
  try {
    const knowledgeBases = await KnowledgeBase.find({ 
      baseModelId: req.params.modelId 
    }).populate('baseModelId');
    res.json(knowledgeBases);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching knowledge bases', error });
  }
});

const createKnowledgeBase: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { displayName, description, baseModelId } = req.body;
    
    const model = await AIModel.findById(baseModelId);
    if (!model) {
      res.status(404).json({ message: 'Model not found' });
      return;
    }
    
    const knowledgeBase = await KnowledgeBase.create({
      name: `kb_${Date.now()}`,
      displayName,
      description,
      baseModelId,
      collectionName: `vector_store_${Date.now()}`
    });
    
    res.json(knowledgeBase);
  } catch (error) {
    next(error);
  }
};

router.post('/', roleGuard(['Staffs']), createKnowledgeBase);

// เพิ่ม endpoint สำหรับสร้าง knowledge base ใหม่
router.post('/', async (req, res) => {
  try {
    const { name, description } = req.body;
    const newKnowledgeBase = new KnowledgeBase({
      name,
      description
    });
    await newKnowledgeBase.save();
    res.json({
      success: true,
      data: newKnowledgeBase
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating knowledge base',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 