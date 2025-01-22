import { Router, Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import axios from 'axios';
import TrainingData from '../models/TrainingData';
import multer from 'multer';
import { extname } from 'path';
import pdf from 'pdf-parse';
import xlsx from 'xlsx';
import mammoth from 'mammoth';

const router = Router();

// เพิ่ม interface สำหรับ user จาก request
interface RequestWithUser extends Request {
  user: {
    nameID: string;
    username: string;
    firstName: string;
    lastName: string;
    groups: string[];
  };
}

// ตั้งค่า multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // จำกัด 10MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.txt', '.pdf', '.docx', '.xlsx', '.csv'];
    const ext = extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('file type must be .txt, .pdf, .docx, .xlsx และ .csv'));
    }
  }
});

// เพิ่ม endpoint สำหรับดูข้อมูล training ทั้งหมด
router.get('/training-data', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const userNameID = (req as RequestWithUser).user.nameID;
    
    // ดึงเฉพาะข้อมูลที่ user สร้าง ไม่ว่าจะ active หรือไม่
    const trainingData = await TrainingData.find({ 
      'createdBy.username': userNameID
    }).sort({ createdAt: -1 });
    
    res.json(trainingData);
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ 
      message: 'Failed to fetch training data',
      error: err.message 
    });
  }
});

// endpoint สำหรับอัพโหลดไฟล์
router.post('/train/file', roleGuard(['Staffs']), upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'Please upload a file' });
      return;
    }

    let extractedText = '';
    const ext = extname(req.file.originalname).toLowerCase();

    // แปลงไฟล์เป็นข้อความตามประเภท
    switch (ext) {
      case '.txt':
        extractedText = req.file.buffer.toString('utf-8');
        break;
      case '.pdf':
        const pdfData = await pdf(req.file.buffer);
        extractedText = pdfData.text;
        break;
      case '.docx':
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        extractedText = result.value;
        break;
      case '.xlsx':
      case '.csv':
        const workbook = xlsx.read(req.file.buffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        extractedText = xlsx.utils.sheet_to_csv(worksheet);
        break;
    }

    const user = (req as RequestWithUser).user;

    await TrainingData.create({
      content: extractedText,
      createdBy: {
        nameID: user.nameID || '',
        username: user.username || '',
        firstName: user.firstName || '',
        lastName: user.lastName || ''
      },
      isActive: true,
      fileType: ext.substring(1) // เก็บประเภทไฟล์โดยตัด . ออก
    });

    // ดึงข้อมูลทั้งหมดที่ active และ train
    const allTrainingData = await TrainingData.find({ isActive: true });
    const combinedContent = allTrainingData
      .map(data => data.content)
      .join('\n\n');

    await axios.post('http://ollama:11434/api/create', {
      name: 'mfu-custom',
      modelfile: `FROM llama2
SYSTEM "You are an AI assistant for MFU University. Here is your knowledge base:

${combinedContent}

Use this knowledge to help answer questions. If the question is not related to the provided knowledge, respond that you don't have information about that topic."
`
    });

    res.status(200).json({ 
      message: 'File uploaded and AI trained successfully',
      totalDataPoints: allTrainingData.length
    });

  } catch (error: unknown) {
    console.error('Training error:', error);
    const err = error as Error;
    res.status(500).json({ 
      message: 'Error in training',
      error: err.message
    });
  }
});

// endpoint สำหรับเปิด/ปิดการใช้งานข้อมูล
router.patch('/training-data/:id', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    await TrainingData.findByIdAndUpdate(id, { isActive });
    
    // ดึงข้อมูลทั้งหมดที่ active และ retrain
    const allTrainingData = await TrainingData.find({ isActive: true });
    const combinedContent = allTrainingData
      .map(data => data.content)
      .join('\n\n');

    // retrain model ด้วยข้อมูลที่ active
    await axios.post('http://ollama:11434/api/create', {
      name: 'mfu-custom',
      modelfile: `FROM llama2
SYSTEM "You are an AI assistant for MFU University. Here is your knowledge base:

${combinedContent}

Use this knowledge to help answer questions. If the question is not related to the provided knowledge, respond that you don't have information about that topic."
`
    });
    
    res.json({ 
      message: 'Training data updated and model retrained successfully',
      activeDataPoints: allTrainingData.length
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ 
      message: 'Failed to update training data',
      error: err.message 
    });
  }
});

// endpoint สำหรับลบข้อมูล
router.delete('/training-data/:id', roleGuard(['Staffs']), async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    await TrainingData.findByIdAndDelete(id);
    
    // ดึงข้อมูลทั้งหมดที่ active และ retrain
    const allTrainingData = await TrainingData.find({ isActive: true });
    const combinedContent = allTrainingData
      .map(data => data.content)
      .join('\n\n');

    // retrain model หลังจากลบข้อมูล
    await axios.post('http://ollama:11434/api/create', {
      name: 'mfu-custom',
      modelfile: `FROM llama2
SYSTEM "You are an AI assistant for MFU University. Here is your knowledge base:

${combinedContent}

Use this knowledge to help answer questions. If the question is not related to the provided knowledge, respond that you don't have information about that topic."
`
    });
    
    res.json({ 
      message: 'Training data deleted and model retrained successfully',
      activeDataPoints: allTrainingData.length
    });
  } catch (error: unknown) {
    const err = error as Error;
    res.status(500).json({ 
      message: 'Failed to delete training data',
      error: err.message 
    });
  }
});

router.post('/training-data', async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const user = (req as RequestWithUser).user;
    
    // Add system prompt to enforce privacy rules
    const systemPrompt = `
    You are an AI assistant for MFU University. Here is your knowledge base:

    ${content}

    Important rules:
    1. If someone asks about personal information (like student ID, phone number, age, etc.), 
       only provide information if they are asking about themselves.
    2. If they ask about someone else's personal information, respond that you cannot provide 
       that information due to privacy concerns.
    3. For general questions not related to personal information, you can answer normally.
    4. When someone asks about their own information, verify their identity based on their 
       first name and last name before providing the information.
    
    Example responses:
    - If "John Smith" asks about "John Smith": Provide the information
    - If "John Smith" asks about "Jane Doe": "Sorry, I cannot provide personal information about others."
    - If asked general questions: Provide normal responses
    `;

    // Train model with updated system prompt
    await axios.post('http://ollama:11434/api/create', {
      name: 'mfu-custom',
      modelfile: `FROM llama2
SYSTEM "${systemPrompt}"
`
    });

    res.json({ 
      message: 'Training data added and model retrained successfully' 
    });

  } catch (error) {
    // ... error handling ...
  }
});

export default router; 