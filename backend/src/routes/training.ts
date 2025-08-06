import express, { Request, Response } from 'express';
import multer from 'multer';
import { authenticateJWT, requireAnyRole } from '../middleware/auth';
import { trainingService } from '../services/trainingService';
import { IUser } from '../models/user';

const router = express.Router();

// Apply authentication middleware to all training routes
router.use(authenticateJWT, requireAnyRole);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
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
router.post('/upload', (req: Request, res: Response, next: any) => {
  return upload.single('file')(req, res, (err: any) => {
    if (err) {
      console.log('❌ Multer error:', err.message);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ error: err.message });
    }
    return next();
  });
}, async (req: Request, res: Response) => {
  try {
    console.log('📁 Training upload request:', {
      hasFile: !!req.file,
      body: req.body,
      fileInfo: req.file ? {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : null
    });

    if (!req.file) {
      console.log('❌ No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { collectionName, modelId } = req.body;
    if (!collectionName) {
      console.log('❌ Collection name is required');
      return res.status(400).json({ error: 'Collection name is required' });
    }

    // Get user from request and map to expected format
    const jwtUser = req.user as any;
    const user = {
      _id: jwtUser.sub,
      nameID: jwtUser.nameID,
      username: jwtUser.username,
      email: jwtUser.email,
      firstName: jwtUser.firstName,
      lastName: jwtUser.lastName,
      department: jwtUser.department,
      role: jwtUser.role,
      groups: jwtUser.groups || [],
      created: new Date(),
      updated: new Date()
    } as IUser;

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
    console.error('❌ Training upload error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
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