import { Router } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import multer from 'multer';
import path from 'path';

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

// เฉพาะ Staff เท่านั้นที่เข้าถึงได้
router.post('/upload', roleGuard(['Staffs']), upload.single('file'), async (req, res) => {
  try {
    // โค้ดสำหรับประมวลผลไฟล์และเก็บข้อมูลลง Vector Database
  } catch (error) {
    res.status(500).json({ error: 'Error processing file' });
  }
});

export default router; 