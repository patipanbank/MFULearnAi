import express, { Request, Response } from 'express';
import { collectionService } from '../services/collectionService';
import { chromaService } from '../services/chromaService';
import { CollectionPermission } from '../models/collection';
import { IUser, UserRole } from '../models/user';

const router = express.Router();

// Note: This is a standalone microservice version
// Authentication should be handled by API Gateway or calling service
// For now, we expect user information to be passed in headers or request body

// Get collection analytics
router.get('/analytics', async (req: Request, res: Response) => {
  try {
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

// Search collections
router.get('/search/:query', async (req: Request, res: Response) => {
  try {
    const { query } = req.params;
    // For microservice: user info would come from headers or auth service
    const user = req.body.user || req.headers['x-user-info'];
    const userId = user?.username;
    const department = user?.department;
    const collections = await collectionService.searchCollections(query, userId, department);
    res.json(collections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get collections by user
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const collections = await collectionService.getCollectionsByUser(userId);
    res.json(collections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get collections by department
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
    // For microservice: user info would come from headers or body
    const user = req.body.user || JSON.parse(req.headers['x-user-info'] as string || '{}');
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
    const { name, permission, modelId, user } = req.body;
    const collection = await collectionService.createCollection(name, permission, user, modelId);
    res.status(201).json(collection);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Get collection by ID
router.get('/:collectionId', async (req: Request, res: Response) => {
  try {
    const { collectionId } = req.params;
    const user = req.body.user || JSON.parse(req.headers['x-user-info'] as string || '{}');

    const collection = await collectionService.getCollectionById(collectionId);
    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    if (user && !collectionService.canUserAccessCollection(user, collection)) {
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
    const { collectionId } = req.params;
    const user = req.body.user || JSON.parse(req.headers['x-user-info'] as string || '{}');
    const collection = await collectionService.getCollectionById(collectionId);
    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }
    if (user && !collectionService.canUserModifyCollection(user, collection)) {
      res.status(403).json({ error: 'Not authorized to update this collection' });
      return;
    }
    const updates = req.body;
    delete updates.user; // Remove user from updates
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
    const { collectionId } = req.params;
    const user = req.body.user || JSON.parse(req.headers['x-user-info'] as string || '{}');
    const collection = await collectionService.getCollectionById(collectionId);
    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }
    if (user && !collectionService.canUserModifyCollection(user, collection)) {
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
    const { collectionId } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const user = req.body.user || JSON.parse(req.headers['x-user-info'] as string || '{}');

    const collection = await collectionService.getCollectionById(collectionId);
    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    if (user && !collectionService.canUserAccessCollection(user, collection)) {
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
    const { collectionId } = req.params;
    const { documentIds } = req.body;
    const user = req.body.user || JSON.parse(req.headers['x-user-info'] as string || '{}');

    console.log('🗑️ DELETE documents request:', {
      collectionId,
      user: user?.username,
      documentIds,
      documentIdsType: typeof documentIds,
      documentIdsLength: Array.isArray(documentIds) ? documentIds.length : 'not array'
    });

    const collection = await collectionService.getCollectionById(collectionId);
    if (!collection) {
      console.log('❌ Collection not found:', collectionId);
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    if (user && !collectionService.canUserModifyCollection(user, collection)) {
      console.log('❌ User not authorized to delete documents:', user?.username);
      res.status(403).json({ error: 'Not authorized to delete documents from this collection' });
      return;
    }

    // Validate documentIds
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      console.log('❌ Invalid documentIds:', documentIds);
      res.status(400).json({ error: 'documentIds must be a non-empty array' });
      return;
    }

    console.log('✅ Proceeding to delete documents:', documentIds.length);
    await chromaService.deleteDocuments(collection.name, documentIds);
    console.log('✅ Documents deleted successfully');
    res.json({ message: `${documentIds.length} documents deleted successfully.` });
  } catch (error: any) {
    console.error('❌ Error deleting documents:', error);
    res.status(500).json({ error: `Failed to delete documents: ${error.message}` });
  }
});

export default router;
