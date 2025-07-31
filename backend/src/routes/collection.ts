import express, { Request, Response } from 'express';
import { collectionService } from '../services/collectionService';
import { chromaService } from '../services/chromaService';
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

// Get collection analytics (ต้องอยู่ก่อน /:collectionId)
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;
    const collections = await collectionService.getAllCollections();
    
    let totalCollections = collections.length;
    let totalDocuments = 0;
    let totalSize = 0;
    
    // Get document counts and sizes from ChromaDB
    for (const collection of collections) {
      try {
        const documents = await chromaService.getDocuments(collection.name, 1, 0);
        totalDocuments += documents.total || 0;
        
        // Estimate size (rough calculation)
        // Each document typically has metadata and embedding
        // This is a simplified calculation
        totalSize += (documents.total || 0) * 1024; // 1KB per document estimate
      } catch (error: any) {
        console.error(`Error getting analytics for collection ${collection.name}:`, error);
        continue;
      }
    }
    
    res.json({
      totalCollections,
      totalDocuments,
      totalSize
    });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to get analytics: ${error.message}` });
  }
});

// Get collection statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await collectionService.getCollectionStats();
    if (stats) {
      res.json(stats);
    } else {
      res.status(500).json({ error: 'Failed to get collection statistics' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List public collections
router.get('/public', async (req: Request, res: Response) => {
  try {
    const collections = await collectionService.getAllCollections();
    const publicCollections = collections.filter(c => c.permission === CollectionPermission.PUBLIC);
    res.json(publicCollections);
  } catch (error: any) {
    // Return empty list instead of error to prevent resource exhaustion
    res.json([]);
  }
});

// Search collections (ต้องอยู่ก่อน /:collectionId)
router.get('/search/:query', async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;
    const { query } = req.params;
    const collections = await collectionService.searchCollections(query, user.username, user.department);
    res.json(collections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get collections by user (ต้องอยู่ก่อน /:collectionId)
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const collections = await collectionService.getCollectionsByUser(userId);
    res.json(collections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get collections by department (ต้องอยู่ก่อน /:collectionId)
router.get('/department/:department', async (req: Request, res: Response) => {
  try {
    const { department } = req.params;
    const collections = await collectionService.getCollectionsByDepartment(department);
    res.json(collections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// List all collections user can see
router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;
    const collections = await collectionService.getUserCollections(user);
    res.json(collections);
  } catch (error: any) {
    console.error('Error getting user collections:', error);
    res.status(500).json({ error: 'Failed to get collections' });
  }
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

// Get collection by ID
router.get('/:collectionId', async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;
    const { collectionId } = req.params;

    const collection = await collectionService.getCollectionById(collectionId);
    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    if (!collectionService.canUserAccessCollection(user, collection)) {
      res.status(403).json({ error: 'Not authorized to access this collection' });
      return;
    }

    res.json(collection);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update collection
router.put('/:collectionId', async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;
    const { collectionId } = req.params;
    const collection = await collectionService.getCollectionById(collectionId);
    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }
    if (!collectionService.canUserModifyCollection(user, collection)) {
      res.status(403).json({ error: 'Not authorized to update this collection' });
      return;
    }
    const updates = req.body;
    const updated = await collectionService.updateCollection(collectionId, updates, user);
    if (updated) {
      res.json(updated);
    } else {
      res.status(400).json({ error: 'Failed to update collection' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete collection
router.delete('/:collectionId', async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;
    const { collectionId } = req.params;
    const collection = await collectionService.getCollectionById(collectionId);
    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }
    if (!collectionService.canUserModifyCollection(user, collection)) {
      res.status(403).json({ error: 'Not authorized to delete this collection' });
      return;
    }
    const ok = await collectionService.deleteCollection(collectionId, user);
    if (ok) {
      res.status(204).send();
    } else {
      res.status(500).json({ error: 'Failed to delete collection' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get documents in collection
router.get('/:collectionId/documents', async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;
    const { collectionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const collection = await collectionService.getCollectionById(collectionId);
    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    if (!collectionService.canUserAccessCollection(user, collection)) {
      res.status(403).json({ error: 'Not authorized to view documents in this collection' });
      return;
    }

    const result = await chromaService.getDocuments(collection.name, limit, offset);
    if (!result) {
      res.json([]);
      return;
    }

    res.json(result.documents || []);
  } catch (error: any) {
    console.error(`Error getting documents for collection ${req.params.collectionId}:`, error);
    res.status(500).json({ error: `Failed to get documents: ${error.message}` });
  }
});

// Delete documents from collection
router.delete('/:collectionId/documents', async (req: Request, res: Response) => {
  try {
    const user = req.user as IUser;
    const { collectionId } = req.params;
    const { documentIds } = req.body;

    const collection = await collectionService.getCollectionById(collectionId);
    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    if (!collectionService.canUserModifyCollection(user, collection)) {
      res.status(403).json({ error: 'Not authorized to delete documents from this collection' });
      return;
    }

    await chromaService.deleteDocuments(collection.name, documentIds);
    res.json({ message: `${documentIds.length} documents deleted successfully.` });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to delete documents: ${error.message}` });
  }
});

export default router; 