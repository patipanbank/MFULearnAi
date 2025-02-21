import { Request, Response } from 'express';
import { ModelModel } from '../models/Model';

// Create Model
export const createModel = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const { name, type } = req.body;

    // Validate required fields
    if (!name || !type) {
      res.status(400).json({ message: 'Name and type are required' });
      return;
    }

    // Only staff users are allowed to create personal models.
    // (If the logged-in user is not a staff member, only "official" models can be created.)
    if (type === 'personal' && req.user.role !== 'staff') {
      res.status(403).json({ message: 'Only staff users can create personal models' });
      return;
    }

    const newModel = new ModelModel({
      name,
      type,
      createdBy: req.user._id, // requires that req.user is populated by your auth middleware
    });

    await newModel.save();
    res.status(201).json(newModel);
  } catch (error) {
    console.error('Error creating model:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Rename Model (called via ellipsis menu)
export const renameModel = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ message: 'New name is required' });
      return;
    }

    const modelInstance = await ModelModel.findById(id);
    if (!modelInstance) {
      res.status(404).json({ message: 'Model not found' });
      return;
    }

    // For personal models, only the creator can rename them.
    if (
      modelInstance.type === 'personal' &&
      modelInstance.createdBy.toString() !== req.user._id.toString()
    ) {
      res.status(403).json({ message: 'Not authorized to rename this model' });
      return;
    }

    modelInstance.name = name;
    await modelInstance.save();
    res.status(200).json(modelInstance);
  } catch (error) {
    console.error('Error renaming model:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete Model (called via ellipsis menu)
export const deleteModel = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const { id } = req.params;

    const modelInstance = await ModelModel.findById(id);
    if (!modelInstance) {
      return res.status(404).json({ message: 'Model not found' });
    }

    // For personal models, only the creator is allowed to delete.
    if (modelInstance.type === 'personal' && modelInstance.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this model' });
    }

    await modelInstance.deleteOne();
    return res.status(200).json({ message: 'Model deleted successfully' });
  } catch (error) {
    console.error('Error deleting model:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}; 