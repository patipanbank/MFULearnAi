import { Router, Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import axios from 'axios';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// กำหนดค่า multer สำหรับอัพโหลดไฟล์
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // จำกัดขนาดไฟล์ 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.txt', '.pdf', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

router.post('/upload', roleGuard(['Staffs']), upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    // สร้าง Modelfile สำหรับ training
    const modelfile = `
FROM llama2
SYSTEM You are an AI assistant trained on MFU specific data.

# Training data
${fileContent}

# Template for chat
TEMPLATE """
{{- if .System }}{{ .System }}{{ end }}
User: {{ .Prompt }}
Assistant: {{ .Response }}
"""
`;

    // สร้าง/อัพเดท custom model
    await axios.post('http://ollama:11434/api/create', {
      name: 'mfu-custom-model',
      modelfile: modelfile,
    });

    res.json({ 
      message: 'Model training completed',
      filename: req.file.filename 
    });

  } catch (error: any) {
    console.error('Training error:', error);
    res.status(500).json({ 
      error: 'Training failed', 
      details: error.message 
    });
  }
});

export default router; 