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

export default router; 