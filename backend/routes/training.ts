import { Router, Request, Response, RequestHandler } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import multer from 'multer';
import path from 'path';
import { documentService } from '../services/document';
import { chromaService } from '../services/chroma';
import { ollamaService } from '../services/ollama';
import fs from 'fs';
import { splitTextIntoChunks } from '../utils/textUtils';

const router = Router();
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed types: PDF, TXT, DOC, DOCX, XLS, XLSX'));
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
  const processingFiles = new Set();
  
  try {
    const file = req.file;
    const { modelId, collectionName } = req.body;
    const user = (req as any).user;

    if (!file || !modelId || !collectionName) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const fileKey = `${file.originalname}_${user.username}`;
    if (processingFiles.has(fileKey)) {
      res.status(400).json({ error: 'File is already being processed' });
      return;
    }

    processingFiles.add(fileKey);

    // สร้าง metadata ที่มี timestamp ที่แน่นอน
    const metadata = {
      filename: file.originalname,
      uploadedBy: user.username,
      timestamp: new Date().toISOString(),
      modelId,
      collectionName
    };

    const fileContent = await fs.promises.readFile(file.path, 'utf8');
    const chunks = splitTextIntoChunks(fileContent);
    
    const documents = chunks.map(chunk => ({
      text: chunk,
      metadata: metadata  // ใช้ metadata เดียวกันสำหรับทุก chunk
    }));

    await chromaService.addDocuments(collectionName, documents);
    
    // ลบไฟล์หลังจากประมวลผลเสร็จ
    await fs.promises.unlink(file.path);

    processingFiles.delete(fileKey);
    res.json({ message: 'File uploaded and processed successfully' });
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
    res.json(documents);
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

export default router; 