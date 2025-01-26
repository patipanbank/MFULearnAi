import { Router, Request, Response, RequestHandler } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import multer from 'multer';
import path from 'path';
import { documentService } from '../services/document';
import { chromaService } from '../services/chroma';
import { ollamaService } from '../services/ollama';

const router = Router();
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt', '.doc', '.docx'];
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

const uploadHandler: RequestHandler = async (req, res): Promise<void> => {
  console.log('Upload request received');
  console.log('Headers:', req.headers);
  console.log('File:', req.file);
  
  const typedReq = req as RequestWithUser;
  try {
    if (!typedReq.file) {
      console.log('No file uploaded');
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const file = typedReq.file;
    const { modelId, collectionName } = req.body;
    const user = typedReq.user as IUser;
    if (!file || !modelId || !collectionName) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const chunks = await documentService.processFile(file);

    const metadata = {
      filename: file.originalname,
      uploadedBy: user.email,
      timestamp: new Date().toISOString(),
      modelId,
      collectionName
    };

    const documents = chunks.map(chunk => ({
      text: chunk,
      metadata: metadata
    }));

    await chromaService.addDocuments(collectionName, documents);

    res.json({ message: 'File uploaded and processed successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error processing file' });
  }
};

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

// Get available models
router.get('/models', roleGuard(['Staffs']), async (req, res) => {
  try {
    const models = await ollamaService.getAvailableModels();
    res.json(models);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error fetching models' });
  }
});

// Get available collections
router.get('/collections', roleGuard(['Staffs']), async (req, res) => {
  try {
    const collections = await chromaService.getCollections();
    res.json(collections);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error fetching collections' });
  }
});

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