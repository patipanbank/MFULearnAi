import { Router, Request, Response, RequestHandler, NextFunction } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import multer from 'multer';
import path from 'path';
import { documentService } from '../services/document';
import { chromaService } from '../services/chroma';
import fs from 'fs';
import { splitTextIntoChunks } from '../utils/textUtils';
import { webScraperService } from '../services/webScraper';
import { bedrockService } from '../services/bedrock';
import { Collection, CollectionPermission } from '../models/Collection';

const router = Router();
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

interface IUser {
  nameID: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  groups: string[];
}

interface RequestWithUser extends Request {
  user?: {
    nameID: string;
    username: string;
    email: string;
    firstName: string;
    lastName: string;
    groups: string[];
  };
}

const uploadHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { modelId, collectionName } = req.body;
    const user = (req as any).user;

    console.log(`Processing file: ${file.originalname}`);
    const text = await documentService.processFile(file);
    
    console.log(`Text length (${text.length}) exceeds chunk size (4000), splitting into chunks`);
    const chunks = splitTextIntoChunks(text);
    console.log(`Created ${chunks.length} chunks`);

    const documents = chunks.map(chunk => ({
      text: chunk,
      metadata: {
        filename: file.originalname,
        uploadedBy: user.username,
        timestamp: new Date().toISOString(),
        modelId,
        collectionName
      }
    }));

    console.log(`Adding documents to collection ${collectionName}`);
    await chromaService.addDocuments(collectionName, documents);
    
    res.json({ 
      message: 'File processed successfully',
      chunks: chunks.length
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Error processing upload' });
  }
};

// อนุญาตทั้ง Students และ Staffs ให้เข้าถึง models และ collections ได้
router.get('/models', roleGuard(['Students', 'Staffs']), async (req: Request, res: Response) => {
  try {
    const models = [
      // 'amazon.titan-text-express-v1',
      // 'anthropic.claude-v2',
      'anthropic.claude-3-5-sonnet-20240620-v1:0',
      // 'anthropic.claude-3-haiku-20240307-v1:0'
    ];
    res.json(models);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error fetching models' });
  }
});

router.get('/collections', roleGuard(['Students', 'Staffs']), async (req: Request, res: Response) => {
  try {
    // ดึง collections จาก ChromaDB
    const chromaCollections = await chromaService.getCollections();
    const userData = (req as any).user;

    // ดึงข้อมูล permissions จาก MongoDB
    const mongoCollections = await Collection.find({ 
      name: { $in: chromaCollections } 
    });

    // สร้าง map ของ permissions
    const permissionsMap = new Map(
      mongoCollections.map(col => [col.name, {
        permission: col.permission,
        createdBy: col.createdBy
      }])
    );

    // กรอง collections ตามสิทธิ์
    const accessibleCollections = chromaCollections.filter(name => {
      const collectionInfo = permissionsMap.get(name);
      if (!collectionInfo) return true; // ถ้าไม่มีข้อมูลใน MongoDB ให้เข้าถึงได้

      return (
        collectionInfo.permission === CollectionPermission.PUBLIC ||
        (collectionInfo.permission === CollectionPermission.STAFF_ONLY && userData.groups?.includes('Staffs')) ||
        (collectionInfo.permission === CollectionPermission.PRIVATE && collectionInfo.createdBy === userData.nameID)
      );
    });

    res.json(accessibleCollections);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error fetching collections' });
  }
});

// เฉพาะ Staff เท่านั้นที่เข้าถึงได้
router.post('/upload', roleGuard(['Staffs']), upload.single('file'), uploadHandler);

router.post('/documents', roleGuard(['Students', 'Staffs']), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { modelId, collectionName } = req.body;
    const user = (req as any).user;

    // ตรวจสอบและสร้าง collection ถ้ายังไม่มี
    await chromaService.ensureCollectionExists(collectionName, user);

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    console.log(`Processing file: ${file.originalname}`);
    const text = await documentService.processFile(file);
    
    console.log(`Text length (${text.length}) exceeds chunk size (4000), splitting into chunks`);
    const chunks = splitTextIntoChunks(text);
    console.log(`Created ${chunks.length} chunks`);

    const documents = chunks.map(chunk => ({
      text: chunk,
      metadata: {
        filename: file.originalname,
        uploadedBy: user.username,
        timestamp: new Date().toISOString(),
        modelId,
        collectionName
      }
    }));

    console.log(`Adding documents to collection ${collectionName}`);
    await chromaService.addDocuments(collectionName, documents);
    
    res.json({ 
      message: 'File processed successfully',
      chunks: chunks.length
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error processing document' });
  }
});

router.get('/documents', roleGuard(['Students', 'Staffs']), async (req: Request, res: Response) => {
  try {
    const { collectionName } = req.query;
    const user = (req as any).user;

    if (!collectionName || typeof collectionName !== 'string') {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }

    // ตรวจสอบและสร้าง collection ถ้ายังไม่มี
    await chromaService.ensureCollectionExists(collectionName, user);

    const documents = await chromaService.getAllDocuments(collectionName);
    
    // เพิ่มข้อมูล permission และ createdBy
    const collection = await Collection.findOne({ name: collectionName });
    if (collection) {
      documents.metadatas = documents.metadatas.map(metadata => ({
        ...metadata,
        permission: collection.permission,
        createdBy: collection.createdBy
      }));
    }

    res.json(documents);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error fetching documents' });
  }
});

// แก้ไข endpoint สำหรับลบเอกสาร
router.delete('/documents/:id', roleGuard(['Students', 'Staffs']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { collectionName } = req.query;
    const user = (req as any).user;

    if (!id || !collectionName || typeof collectionName !== 'string') {
      res.status(400).json({ error: 'Missing document ID or collection name' });
      return;
    }

    // ตรวจสอบสิทธิ์การลบ
    const collection = await Collection.findOne({ name: collectionName });
    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    const canDelete = 
      user.groups.includes('Staffs') || 
      collection.createdBy === user.nameID;

    if (!canDelete) {
      res.status(403).json({ error: 'No permission to delete this document' });
      return;
    }

    await chromaService.deleteDocument(collectionName, id);
    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Create new collection
router.post('/collections', roleGuard(['Staffs']), async (req: Request, res: Response) => {
  try {
    const { name, permission } = req.body;
    const user = (req as any).user; // จาก roleGuard middleware

    const collection = await chromaService.createCollection(
      name,
      permission,
      user.nameID
    );

    res.status(201).json({ message: 'Collection created successfully' });
  } catch (error) {
    console.error('Error creating collection:', error);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

// Middleware ตรวจสอบสิทธิ์การเข้าถึง collection
const checkCollectionAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { collectionName } = req.params;
    const user = (req as any).user;

    const hasAccess = await chromaService.checkCollectionAccess(collectionName, user);
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied to this collection' });
    }

    next();
  } catch (error) {
    res.status(500).json({ error: 'Error checking collection access' });
  }
};


// Cleanup endpoint
router.delete('/cleanup', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    await chromaService.deleteDocumentsWithoutModelOrCollection();
    res.status(200).json({ message: 'Cleanup completed successfully' });
  } catch (error) {
    console.error('Error during cleanup:', error);
    res.status(500).json({ error: 'Failed to cleanup documents' });
  }
});

// endpoint สำหรับลบ collection
router.delete('/collections/:name', roleGuard(['Staffs']), async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const user = (req as any).user;

    // ตรวจสอบสิทธิ์ก่อนลบ
    const collection = await Collection.findOne({ name });
    if (!collection) {
      res.status(404).json({ error: 'Collection not found' });
      return;
    }

    // ตรวจสอบว่าเป็น Staff หรือเจ้าของ collection
    if (!user.groups.includes('Staffs') && collection.createdBy !== user.nameID) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    // ลบ collection
    await chromaService.deleteCollection(name);
    res.json({ message: 'Collection deleted successfully' });
  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

// endpoint สำหรับลบหลาย collections
router.delete('/collections', roleGuard(['Staffs']), async (req: Request, res: Response) => {
  try {
    const { collections } = req.body;
    const user = (req as any).user;

    if (!Array.isArray(collections)) {
      res.status(400).json({ error: 'Invalid collections array' });
      return;
    }

    // ตรวจสอบสิทธิ์สำหรับแต่ละ collection
    for (const name of collections) {
      const collection = await Collection.findOne({ name });
      if (collection && !user.groups.includes('Staffs') && collection.createdBy !== user.nameID) {
        res.status(403).json({ error: `Permission denied for collection: ${name}` });
        return;
      }
    }

    await chromaService.deleteCollections(collections);
    res.json({ message: 'Collections deleted successfully' });
  } catch (error) {
    console.error('Error deleting collections:', error);
    res.status(500).json({ error: 'Failed to delete collections' });
  }
});

router.post('/add-urls', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { urls, modelId, collectionName } = req.body;
    const user = (req as any).user;

    if (!Array.isArray(urls) || urls.length === 0) {
      res.status(400).json({ error: 'Invalid URLs format' });
      return;
    }

    const scrapedContents = await webScraperService.scrapeUrls(urls);
    
    for (const { url, content } of scrapedContents) {
      const chunks = splitTextIntoChunks(content);
      
      // สร้าง filename จาก URL
      const filename = new URL(url).hostname + new URL(url).pathname;
      
      const documents = chunks.map(chunk => ({
        text: chunk,
        metadata: {
          filename: filename, // เพิ่ม filename
          source: url,
          uploadedBy: user.username,
          timestamp: new Date().toISOString(),
          modelId,
          collectionName
        }
      }));

      await chromaService.addDocuments(collectionName, documents);
    }

    res.json({ 
      message: 'URLs processed successfully',
      processedUrls: scrapedContents.length
    });

  } catch (error) {
    console.error('URL processing error:', error);
    res.status(500).json({ error: (error as Error).message || 'Error processing URLs' });
  }
});

// เพิ่ม endpoint สำหรับลบข้อมูลทั้งหมดในคอลเลกชัน
router.delete('/documents/all/:collectionName', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionName } = req.params;
    await chromaService.deleteAllDocuments(collectionName);
    res.status(200).json({ message: 'All documents deleted successfully' });
  } catch (error) {
    console.error('Error deleting all documents:', error);
    res.status(500).json({ error: 'Failed to delete all documents' });
  }
});

export default router; 