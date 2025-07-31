import express, { Request, Response } from 'express';
import multer from 'multer';
import { authenticateJWT, requireAnyRole } from '../middleware/auth';
import { trainingService } from '../services/trainingService';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common document formats
    const allowedMimes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, CSV, XLS, XLSX files are allowed.'));
    }
  }
});

// POST /api/training/upload
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { collectionName, modelId } = req.body;
    if (!collectionName) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    // Get user from request
    const user = req.user as any;

    // Process file and create embeddings
    const chunksCount = await trainingService.processAndEmbedFile(
      req.file.buffer,
      req.file.originalname,
      user,
      modelId || 'amazon.titan-embed-text-v1',
      collectionName
    );

    return res.json({
      message: 'File processed successfully with vector embeddings',
      filename: req.file.originalname,
      size: req.file.size,
      collectionName: collectionName,
      modelId: modelId || 'amazon.titan-embed-text-v1',
      chunks: chunksCount
    });

  } catch (error: any) {
    console.error('Training upload error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to upload file' 
    });
  }
});

// GET /api/training/status
router.get('/status', async (req: Request, res: Response) => {
  try {
    // TODO: Implement training status endpoint
    res.json({
      status: 'idle',
      message: 'Training service is available'
    });
  } catch (error: any) {
    console.error('Training status error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to get training status' 
    });
  }
});

export default router; 