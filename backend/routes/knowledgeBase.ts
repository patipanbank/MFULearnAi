import express, { RequestHandler } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import KnowledgeBase from '../models/KnowledgeBase';
import AIModel from '../models/AIModel';

const router = express.Router();

// Get all knowledge bases
router.get('/', async (req, res) => {
  try {
    const knowledgeBases = await KnowledgeBase.find()
      .populate('baseModelId')
      .sort({ createdAt: -1 });
    res.json(knowledgeBases);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching knowledge bases', error });
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

export default router; 