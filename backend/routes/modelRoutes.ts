import { Router } from 'express';
import { createModel, renameModel, deleteModel } from '../controllers/modelController';
import { protect } from '../middleware/authMiddleware'; // your authentication middleware

const router = Router();

// Create a model
router.post('/', protect, createModel);

// Rename a model
router.put('/:id', protect, renameModel);

// Delete a model
router.delete('/:id', protect, async (req, res, next) => {
  try {
    await deleteModel(req, res);
  } catch (error) {
    next(error);
  }
});

export default router; 