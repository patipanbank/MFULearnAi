import { Router, Request, Response } from 'express';
import { CollectionModel, CollectionPermission } from '../models/Collection';
import { roleGuard } from '../middleware/roleGuard';
import { UserRole } from '../models/User';

const router = Router();

// GET /api/collections  – list collections filtered by permission / ownership
router.get('/', roleGuard(['Students', 'Staffs', 'Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userId = user.nameID || user.username;
    const userGroups = user.groups || [];

    const all = await CollectionModel.find({}).lean();

    const filtered = all.filter(c => {
      if (c.permission === CollectionPermission.PUBLIC) return true;
      const isOwner = c.createdBy === userId;
      const isStaff = userGroups.includes('Staffs') || userGroups.includes('Admin') || userGroups.includes('SuperAdmin');
      return isOwner || isStaff;
    });

    res.json(filtered);
  } catch (err) {
    console.error('Error listing collections:', err);
    res.status(500).json({ error: 'Failed to list collections' });
  }
});

// POST /api/collections  – create new collection
router.post('/', roleGuard(['Staffs', 'Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response) => {
  try {
    const { name, description = '', permission = CollectionPermission.PRIVATE } = req.body;
    const user = (req as any).user;

    if (!name) return res.status(400).json({ error: 'Name is required' });

    const exists = await CollectionModel.findOne({ name });
    if (exists) return res.status(409).json({ error: 'Collection name already exists' });

    const newCol = await CollectionModel.create({
      name,
      description,
      permission,
      createdBy: user.nameID || user.username,
      summary: '',
    });

    res.status(201).json(newCol);
  } catch (err) {
    console.error('Error creating collection:', err);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

// PUT /api/collections/:id  – update description / permission
router.put('/:id', roleGuard(['Staffs', 'Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { description, permission } = req.body;
    const user = (req as any).user;

    const col = await CollectionModel.findById(id);
    if (!col) return res.status(404).json({ error: 'Collection not found' });

    const isOwner = col.createdBy === (user.nameID || user.username);
    const isAdmin = (user.groups || []).some((g: string) => ['Admin', 'SuperAdmin'].includes(g));
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Permission denied' });

    if (description !== undefined) col.description = description;
    if (permission !== undefined) col.permission = permission;
    await col.save();

    res.json(col);
  } catch (err) {
    console.error('Error updating collection:', err);
    res.status(500).json({ error: 'Failed to update collection' });
  }
});

// DELETE /api/collections/:id – delete collection (and optionally cascade documents)
router.delete('/:id', roleGuard(['Admin', 'SuperAdmin'] as UserRole[]), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await CollectionModel.findByIdAndDelete(id);
    // NOTE: In production, also delete documents in this collection.
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting collection:', err);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

export default router; 