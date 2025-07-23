import express, { Request, Response } from 'express';
import { collectionService } from '../services/collectionService';
import { CollectionPermission } from '../models/collection';
import { User, IUser, UserRole } from '../models/user';
import mongoose from 'mongoose';
import { authenticateJWT, requireAnyRole } from '../middleware/auth';

const router = express.Router();

// Mock auth middleware (ควรเปลี่ยนเป็น auth จริง)
// function mockAuth(req: Request, res: Response, next: Function) {
//   // ตัวอย่าง user (ควรดึงจาก session/jwt จริง)
//   req.user = {
//     _id: new mongoose.Types.ObjectId(),
//     nameID: '12345',
//     username: 'johndoe',
//     email: 'johndoe@example.com',
//     role: UserRole.STAFFS,
//     department: 'IT',
//     groups: [],
//     created: new Date(),
//     updated: new Date(),
//   } as Partial<IUser> as IUser;
//   next();
// }

router.use(authenticateJWT, requireAnyRole);

// List all collections user can see
router.get('/', async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const collections = await collectionService.getUserCollections(user);
  res.json(collections);
  return; // Explicitly return to satisfy TypeScript
});

// List public collections
router.get('/public', async (req: Request, res: Response) => {
  const collections = await collectionService.getAllCollections();
  res.json(collections.filter(c => c.permission === CollectionPermission.PUBLIC));
  return; // Explicitly return to satisfy TypeScript
});

// Create collection
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;
    const { name, permission, modelId } = req.body;
    const collection = await collectionService.createCollection(name, permission, user, modelId);
    res.status(201).json(collection);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Update collection
router.put('/:collectionId', async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const { collectionId } = req.params;
  const collection = await collectionService.getCollectionById(collectionId);
  if (!collection) {
    res.status(404).json({ error: 'Collection not found' });
    return null;
  }
  if (!collectionService.canUserModifyCollection(user, collection)) {
    res.status(403).json({ error: 'Not authorized' });
    return null;
  }
  const updates = req.body;
  const updated = await collectionService.updateCollection(collectionId, updates);
  res.json(updated);
  return null;
});

// Delete collection
router.delete('/:collectionId', async (req: Request, res: Response) => {
  const user = req.user as IUser;
  const { collectionId } = req.params;
  const collection = await collectionService.getCollectionById(collectionId);
  if (!collection) {
    res.status(404).json({ error: 'Collection not found' });
    return null;
  }
  if (!collectionService.canUserModifyCollection(user, collection)) {
    res.status(403).json({ error: 'Not authorized' });
    return null;
  }
  const ok = await collectionService.deleteCollection(collectionId);
  if (ok) {
    res.status(204).send();
    return null;
  } else {
    res.status(500).json({ error: 'Delete failed' });
    return null;
  }
});

export default router; 