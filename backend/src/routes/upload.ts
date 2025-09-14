import express, { Request, Response } from 'express';
import multer from 'multer';
import { storageService } from '../services/storageService';

const router = express.Router();
const upload = multer();

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    if (file.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large (max 10 MB)' });
    }
    const url = await storageService.uploadFile(file.buffer, file.originalname, file.mimetype || 'application/octet-stream');
    return res.json({ url, mediaType: file.mimetype });
  } catch (e: any) {
    return res.status(500).json({ error: `Upload failed: ${e.message}` });
  }
});

// New endpoint to match frontend usage: POST /api/upload/image
router.post('/image', upload.single('file'), async (req: Request, res: Response) => {
  try {
    console.log('📤 Image upload request received');

    // Check storage service health first
    const isHealthy = await storageService.healthCheck();
    if (!isHealthy) {
      console.log('❌ Storage service unhealthy');
      return res.status(503).json({ error: 'Storage service unavailable' });
    }

    const file = req.file;

    if (!file) {
      console.log('❌ No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('📋 File details:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      bufferLength: file.buffer?.length
    });

    if (file.size > 10 * 1024 * 1024) {
      console.log('❌ File too large:', file.size);
      return res.status(400).json({ error: 'File too large (max 10 MB)' });
    }

    // Basic type guard for images
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      console.log('❌ Unsupported file type:', file.mimetype);
      return res.status(400).json({ error: 'Unsupported image type' });
    }

    console.log('☁️ Uploading to storage service...');
    const url = await storageService.uploadFile(file.buffer, file.originalname, file.mimetype);
    console.log('✅ Upload successful:', url);

    return res.json({ url, mediaType: file.mimetype });
  } catch (e: any) {
    console.error('❌ Upload error:', {
      message: e.message,
      stack: e.stack,
      name: e.name
    });
    return res.status(500).json({ error: `Upload failed: ${e.message}` });
  }
});

// Debug endpoint to check storage service status
router.get('/status', async (req: Request, res: Response) => {
  try {
    const isHealthy = await storageService.healthCheck();
    const config = {
      S3_ENDPOINT: process.env.S3_ENDPOINT || 'http://minio:9000',
      S3_BUCKET: process.env.S3_BUCKET || 'uploads',
      S3_PUBLIC_ENDPOINT: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || 'http://minio:9000',
      S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ? '***' + (process.env.S3_ACCESS_KEY.slice(-4)) : 'undefined',
    };

    return res.json({
      healthy: isHealthy,
      config,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return res.status(500).json({
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to test image URLs
router.get('/debug/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const S3_BUCKET = process.env.S3_BUCKET || 'uploads';
    const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://mfulearnai_minio:9000';

    // Use same logic as storageService
    const getPublicEndpoint = () => {
      if (process.env.S3_PUBLIC_ENDPOINT) {
        return process.env.S3_PUBLIC_ENDPOINT;
      }

      if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
        return 'https://mfulearnai.mfu.ac.th/minio';
      }

      if (S3_ENDPOINT.includes('mfulearnai_minio') || S3_ENDPOINT.includes('minio:')) {
        return 'http://localhost:9000';
      }

      return S3_ENDPOINT;
    };

    const PUBLIC_ENDPOINT = getPublicEndpoint();

    // Try to get the image as base64
    const testUrl = `${S3_ENDPOINT}/${S3_BUCKET}/${filename}`;
    const publicUrl = `${PUBLIC_ENDPOINT}/${S3_BUCKET}/${filename}`;

    console.log(`🔍 Testing image URL (internal): ${testUrl}`);
    console.log(`🔍 Testing image URL (public): ${publicUrl}`);

    const result = await storageService.getFileAsBase64(publicUrl);

    if (result) {
      return res.json({
        success: true,
        internalUrl: testUrl,
        publicUrl: publicUrl,
        mediaType: result.mediaType,
        size: result.data.length,
        sizeKB: Math.round(result.data.length / 1024),
        preview: result.data.substring(0, 100) + '...'
      });
    } else {
      return res.status(404).json({
        success: false,
        internalUrl: testUrl,
        publicUrl: publicUrl,
        error: 'Image not found or failed to convert to base64'
      });
    }
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router; 