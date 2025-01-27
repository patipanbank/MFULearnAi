import { Router, Request, Response, RequestHandler } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import multer from 'multer';
import path from 'path';
import { documentService } from '../services/document';
import { chromaService } from '../services/chroma';
import { ollamaService } from '../services/ollama';
import fs from 'fs';
import { splitTextIntoChunks } from '../utils/textUtils';
import { webScraperService } from '../services/webScraper';

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
    
    console.log(`Text length (${text.length}) exceeds chunk size (8000), splitting into chunks`);
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
router.get('/models', roleGuard(['Students', 'Staffs']), async (req, res) => {
  try {
    const models = await ollamaService.getAvailableModels();
    res.json(models);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error fetching models' });
  }
});

router.get('/collections', roleGuard(['Students', 'Staffs']), async (req, res) => {
  try {
    const collections = await chromaService.getCollections();
    res.json(collections);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error fetching collections' });
  }
});

// เฉพาะ Staff เท่านั้นที่เข้าถึงได้
router.post('/upload', roleGuard(['Staffs']), upload.single('file'), uploadHandler);

const getAllDocumentsHandler: RequestHandler = async (req, res) => {
  try {
    const { collectionName } = req.query;
    if (!collectionName || typeof collectionName !== 'string') {
      res.status(400).json({ error: 'Collection name is required' });
      return;
    }
    const documents = await chromaService.getAllDocuments(collectionName);
    
    // แปลงข้อมูลก่อนส่งกลับ
    const formattedDocuments = documents.ids.map((id, index) => {
      const metadata = documents.metadatas[index] || {};
      const document = documents.documents[index];

      return {
        id,
        document,
        metadata: {
          ...metadata,
          filename: metadata.filename || metadata.fileName || metadata.url || 'Unknown source',
          modelId: metadata.modelId || '',
          collectionName: metadata.collectionName || '',
          uploadedBy: metadata.uploadedBy || '',
          timestamp: metadata.timestamp || new Date().toISOString()
        }
      };
    });
    
    res.json(formattedDocuments);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error fetching documents' });
  }
};

// เพิ่ม route ใหม่
router.get('/documents', roleGuard(['Staffs']), getAllDocumentsHandler);

const deleteDocumentHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { collectionName } = req.query;

    if (!id || !collectionName || typeof collectionName !== 'string') {
      res.status(400).json({ error: 'Missing document ID or collection name' });
      return;
    }

    await chromaService.deleteDocument(collectionName, id);
    res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

router.delete('/documents/:id', roleGuard(['Staffs']), deleteDocumentHandler);

// Create new collection
router.post('/collections', roleGuard(['Staffs']), async (req, res) => {
  try {
    const { collectionName } = req.body;
    await chromaService.initCollection(collectionName);
    res.json({ message: 'Collection created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error creating collection' });
  }
});

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

router.delete('/collections/:name', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    await chromaService.deleteCollection(name);
    res.status(200).json({ message: 'Collection deleted successfully' });
  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({ error: 'Failed to delete collection' });
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
      
      const documents = chunks.map(chunk => ({
        text: chunk,
        metadata: {
          filename: url,  // เปลี่ยนจาก fileName เป็น filename
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

export default router; 