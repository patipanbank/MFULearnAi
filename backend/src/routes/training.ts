import express, { Request, Response } from 'express';
import multer from 'multer';
import { authenticateJWT, requireAnyRole } from '../middleware/auth';
import { trainingService } from '../services/trainingService';
import { queueService } from '../services/queueService';
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
      error: err?.message,
      bodyKeys: Object.keys(req.body || {}),
      bodyValues: req.body,
      filesKeys: req.files ? Object.keys(req.files) : 'no files object',
      fileObject: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : 'no file object'
    });
    
    if (err) {
      console.log('❌ Multer error:', err.message);
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
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

    const { collectionName, modelId, useQueue } = req.body;
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

    // Check if should use queue (for large files or when specified)
    const shouldUseQueue = useQueue === 'true' || req.file.size > 5 * 1024 * 1024; // 5MB threshold

    if (shouldUseQueue) {
      // Use queue for background processing
      const jobId = await queueService.addFileProcessingJob(
        req.file.buffer,
        req.file.originalname,
        user,
        modelId || 'amazon.titan-embed-text-v1',
        collectionName
      );

      return res.json({
        message: 'File queued for processing',
        jobId: jobId,
        filename: req.file.originalname,
        size: req.file.size,
        collectionName: collectionName,
        modelId: modelId || 'amazon.titan-embed-text-v1',
        queued: true
      });
    } else {
      // Process immediately (for small files)
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
        chunks: chunksCount,
        queued: false
      });
    }

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
    const queueStats = await queueService.getQueueStats();
    
    return res.json({
      status: 'running',
      message: 'Training service is available',
      queue: queueStats
    });
  } catch (error: any) {
    console.error('Training status error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get training status' 
    });
  }
});

// GET /api/training/job/:jobId
router.get('/job/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    
    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const jobProgress = queueService.getJobProgress(jobId);
    
    if (!jobProgress) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json({
      jobId: jobProgress.jobId,
      fileName: jobProgress.fileName,
      status: jobProgress.status,
      progress: jobProgress.progress,
      error: jobProgress.error,
      result: jobProgress.result
    });
  } catch (error: any) {
    console.error('Job status error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get job status' 
    });
  }
});

// GET /api/training/jobs/user
router.get('/jobs/user', async (req: Request, res: Response) => {
  try {
    const jwtUser = req.user as any;
    const userId = jwtUser.sub;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID not found' });
    }

    const userJobs = queueService.getAllJobsForUser(userId);
    
    return res.json({
      jobs: userJobs
    });
  } catch (error: any) {
    console.error('User jobs error:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to get user jobs' 
    });
  }
});

// POST /api/training/scrape-url
router.post('/scrape-url', async (req: Request, res: Response) => {
  try {
    console.log('🌐 URL scraping request:', req.body);

    const { url, collectionName, modelId } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    if (!collectionName) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    // Get user from request
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

    // Process URL
    const chunksCount = await trainingService.processAndEmbedUrl(
      url,
      user,
      modelId || 'amazon.titan-embed-text-v1',
      collectionName
    );

    return res.json({
      message: `URL scraped successfully. ${chunksCount} chunks were added.`,
      url: url,
      collectionName: collectionName,
      modelId: modelId || 'amazon.titan-embed-text-v1',
      chunks: chunksCount
    });

  } catch (error: any) {
    console.error('❌ URL scraping error:', error);
    
    if (error.message && error.message.includes('Invalid URL')) {
      return res.status(400).json({ 
        error: error.message,
        code: 'INVALID_URL'
      });
    }
    if (error.message && error.message.includes('No readable content')) {
      return res.status(400).json({
        error: 'No readable content found from URL.',
        code: 'NO_CONTENT'
      });
    }
    if (error.message && error.message.includes('timeout')) {
      return res.status(408).json({
        error: 'Request timeout. The website is taking too long to respond.',
        code: 'TIMEOUT'
      });
    }
    
    return res.status(500).json({ 
      error: error.message || 'Failed to scrape URL' 
    });
  }
});

// POST /api/training/text
router.post('/text', async (req: Request, res: Response) => {
  try {
    console.log('📝 Text processing request:', {
      hasText: !!req.body.text,
      textLength: req.body.text?.length || 0,
      documentName: req.body.documentName,
      collectionName: req.body.collectionName
    });

    const { text, documentName, collectionName, modelId } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text content is required' });
    }
    if (!documentName) {
      return res.status(400).json({ error: 'Document name is required' });
    }
    if (!collectionName) {
      return res.status(400).json({ error: 'Collection name is required' });
    }
    if (text.length < 10) {
      return res.status(400).json({ error: 'Text content too short (minimum 10 characters required)' });
    }
    if (text.length > 1000000) { // 1MB limit
      return res.status(400).json({ error: 'Text content too large (maximum 1MB)' });
    }

    // Get user from request
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

    // Process text
    const chunksCount = await trainingService.processAndEmbedText(
      text,
      documentName,
      user,
      modelId || 'amazon.titan-embed-text-v1',
      collectionName
    );

    return res.json({
      message: `Text processed successfully. ${chunksCount} chunks were added.`,
      documentName: documentName,
      textLength: text.length,
      collectionName: collectionName,
      modelId: modelId || 'amazon.titan-embed-text-v1',
      chunks: chunksCount
    });

  } catch (error: any) {
    console.error('❌ Text processing error:', error);
    
    return res.status(500).json({ 
      error: error.message || 'Failed to process text' 
    });
  }
});

export default router; 