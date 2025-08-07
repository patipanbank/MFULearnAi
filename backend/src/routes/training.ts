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
    fileSize: 50 * 1024 * 1024, // 50MB limit (increased for larger documents)
    files: 1, // Only one file at a time
  },
  fileFilter: (req: any, file: any, cb: any) => {
    console.log('🔍 Multer fileFilter called:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Allow common document formats
    const allowedMimes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Additional MIME types for better compatibility
      'application/csv',
      'text/csv',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/vnd.ms-excel.template.macroEnabled.12'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      console.log('✅ File type allowed');
      cb(null, true);
    } else {
      console.log('❌ File type not allowed:', file.mimetype);
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, CSV, XLS, XLSX files are allowed.'));
    }
  }
});

// POST /api/training/upload
router.post('/upload', (req: Request, res: Response, next: any) => {
  console.log('📝 Upload route called, headers:', {
    'content-type': req.headers['content-type'],
    'content-length': req.headers['content-length']
  });
  
  return upload.single('file')(req, res, (err: any) => {
    console.log('🔄 Multer finished:', {
      hasError: !!err,
      hasFile: !!req.file,
      error: err?.message
    });
    
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
    
    // Handle multer errors
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'File too large. Maximum size is 50MB.',
        code: 'FILE_TOO_LARGE',
        maxSize: '50MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        error: 'Too many files. Please upload one file at a time.',
        code: 'TOO_MANY_FILES'
      });
    }
    if (error.message && error.message.includes('Invalid file type')) {
      return res.status(400).json({ 
        error: error.message,
        code: 'INVALID_FILE_TYPE',
        allowedTypes: ['PDF', 'DOCX', 'XLSX', 'CSV', 'TXT']
      });
    }
    if (error.message && error.message.includes('No readable content')) {
      return res.status(400).json({
        error: 'File appears to be empty or corrupted.',
        code: 'EMPTY_FILE'
      });
    }
    
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