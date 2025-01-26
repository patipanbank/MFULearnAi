import { Router, Request, Response, RequestHandler } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import multer from 'multer';
import path from 'path';
import { documentService } from '../services/document';
import { chromaService } from '../services/chroma';

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

    const chunks = await documentService.processFile(typedReq.file);

    await chromaService.addDocuments(
      chunks.map(text => ({
        text,
        metadata: {
          filename: typedReq.file!.originalname,
          uploadedBy: typedReq.user?.username || 'unknown',
          timestamp: new Date().toISOString()
        }
      }))
    );

    res.json({ success: true, chunks: chunks.length });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error processing file' });
  }
};

// เฉพาะ Staff เท่านั้นที่เข้าถึงได้
router.post('/upload', roleGuard(['Staffs']), upload.single('file'), uploadHandler);

const getAllDocumentsHandler: RequestHandler = async (req, res) => {
  try {
    const documents = await chromaService.getAllDocuments();
    res.json(documents);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Error fetching documents' });
  }
};

// เพิ่ม route ใหม่
router.get('/documents', roleGuard(['Staffs']), getAllDocumentsHandler);

export default router; 