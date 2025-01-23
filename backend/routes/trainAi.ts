import { Router, Request, Response } from 'express';
import { roleGuard } from '../middleware/roleGuard';
import axios from 'axios';
import TrainingData from '../models/TrainingData';
import multer from 'multer';
import { extname } from 'path';
import pdf from 'pdf-parse';
import xlsx from 'xlsx';
import mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { PDFImage } from 'pdf-image';
import { basename } from 'path';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import NodeZip from 'node-zip';

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
  limits: { fileSize: 50 * 1024 * 1024 }, // เพิ่มเป็น 50MB
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['.txt', '.pdf', '.docx', '.xlsx', '.csv', '.png', '.jpg', '.jpeg'];
    const ext = extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('ไฟล์ต้องเป็นประเภท .txt, .pdf, .docx, .xlsx, .csv, .png, .jpg หรือ .jpeg เท่านั้น'));
    }
  }
});

// เพิ่ม endpoint สำหรับดูข้อมูล training ทั้งหมด
router.get('/training-data', async (req: Request, res: Response) => {
  try {
    const trainingData = await TrainingData.find()
      .sort({ createdAt: -1 }) // เรียงจากใหม่ไปเก่า
      .lean(); // ใช้ lean() เพื่อความเร็วในการดึงข้อมูล
    
    console.log('Sending training data:', trainingData); // debug log
    res.json(trainingData);
  } catch (error: any) {
    console.error('Error fetching training data:', error);
    res.status(500).json({ 
      message: 'Failed to fetch training data',
      error: error.message 
    });
  }
});

// เพิ่มฟังก์ชันสำหรับดึงรูปภาพจาก PDF
async function extractImagesFromPDF(buffer: Buffer): Promise<string[]> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pdf-images-'));
  const tempPdfPath = path.join(tempDir, 'temp.pdf');
  await fs.writeFile(tempPdfPath, buffer);

  const pdfImage = new PDFImage(tempPdfPath, {
    convertOptions: {
      '-quality': '100',
      '-density': '300'
    }
  });

  try {
    const numberOfPages = await pdfImage.numberOfPages();
    const imageTexts: string[] = [];

    for (let i = 0; i < numberOfPages; i++) {
      const imagePath = await pdfImage.convertPage(i);
      const imageBuffer = await fs.readFile(imagePath);
      const text = await extractTextFromImage(imageBuffer);
      imageTexts.push(text);
      await fs.unlink(imagePath); // ลบไฟล์ภาพชั่วคราว
    }

    await fs.rm(tempDir, { recursive: true }); // ลบโฟลเดอร์ชั่วคราว
    return imageTexts;
  } catch (error) {
    await fs.rm(tempDir, { recursive: true }); // ลบโฟลเดอร์ชั่วคราวในกรณีเกิดข้อผิดพลาด
    throw error;
  }
}

// เพิ่มฟังก์ชันสำหรับดึงรูปภาพจาก DOCX
async function extractImagesFromDOCX(buffer: Buffer): Promise<string[]> {
  const zip = new NodeZip(buffer);
  const imageTexts: string[] = [];
  
  for (const filename in zip.files) {
    if (filename.startsWith('word/media/')) {
      const imageBuffer = zip.files[filename]._data;
      if (imageBuffer) {
        try {
          const text = await extractTextFromImage(imageBuffer);
          imageTexts.push(text);
        } catch (error) {
          console.warn(`Could not process image ${filename}:`, error);
        }
      }
    }
  }
  
  return imageTexts;
}

// อัพเดทฟังก์ชัน extractTextFromImage
async function extractTextFromImage(buffer: Buffer): Promise<string> {
  try {
    // ปรับแต่งรูปภาพเพื่อเพิ่มความแม่นยำในการ OCR
    const processedBuffer = await sharp(buffer)
      .resize(2000, 2000, { fit: 'inside' })
      .normalize()
      .sharpen()
      .gamma(1.2) // ปรับความสว่าง
      .toBuffer();

    const worker = await createWorker('tha+eng');
    
    // ตั้งค่า OCR
    await worker.setParameters({
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ก-๙.,!?()[]{}:;"\'/ -_+=',
      preserve_interword_spaces: '1',
    });

    const { data: { text } } = await worker.recognize(processedBuffer);
    await worker.terminate();
    
    return text.trim();
  } catch (error) {
    console.error('Error extracting text from image:', error);
    throw new Error('Could not extract text from image');
  }
}

// อัพเดท endpoint สำหรับอัพโหลดไฟล์
router.post('/upload', roleGuard(['Staffs']), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { 
      datasetName,
      modelName = 'mfu-custom',
      accessGroups = ['Students', 'Staffs'],
      category 
    } = req.body;

    if (!req.file) {
      res.status(400).json({ message: 'Please upload a file' });
      return;
    }

    let extractedText = '';
    let imageTexts: string[] = [];
    const ext = extname(req.file.originalname).toLowerCase();

    // แปลงไฟล์เป็นข้อความตามประเภท
    switch (ext) {
      case '.txt':
        extractedText = req.file.buffer.toString('utf-8');
        break;
      case '.pdf':
        const pdfData = await pdf(req.file.buffer);
        extractedText = pdfData.text;
        // ดึงข้อความจากรูปภาพใน PDF
        imageTexts = await extractImagesFromPDF(req.file.buffer);
        break;
      case '.docx':
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        extractedText = result.value;
        // ดึงข้อความจากรูปภาพใน DOCX
        imageTexts = await extractImagesFromDOCX(req.file.buffer);
        break;
      case '.xlsx':
      case '.csv':
        const workbook = xlsx.read(req.file.buffer);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        extractedText = xlsx.utils.sheet_to_csv(worksheet);
        break;
      case '.png':
      case '.jpg':
      case '.jpeg':
        extractedText = await extractTextFromImage(req.file.buffer);
        break;
    }

    // รวมข้อความจากไฟล์และรูปภาพ
    const combinedText = [extractedText, ...imageTexts]
      .filter(text => text.trim().length > 0)
      .join('\n\n');

    const user = (req as RequestWithUser).user;
    
    // บันทึกลงฐานข้อมูล
    const trainingData = await TrainingData.create({
      name: datasetName,
      content: combinedText,
      modelName,
      accessGroups: JSON.parse(accessGroups),
      category,
      createdBy: {
        nameID: user.nameID,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName
      },
      fileType: ext
    });

    // Train model แยกตามโมเดล
    await trainModel(modelName, trainingData.content, accessGroups);

    res.json({
      message: 'อัพโหลดและ train ข้อมูลสำเร็จ',
      dataId: trainingData._id
    });

  } catch (error) {
    console.error('Error in file upload:', error);
    res.status(500).json({
      message: 'Error uploading file',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// เพิ่มฟังก์ชันสำหรับ train model
async function trainModel(modelName: string, content: string, accessGroups: string[]) {
  const systemPrompt = `
  You are an AI assistant for MFU University. 
  Here is your knowledge base:

  ${content}

  Important rules:
  1. This information is accessible only to users in these groups: ${accessGroups.join(', ')}
  2. For personal information requests, only provide information if the user is asking about themselves
  3. Verify user's identity and permissions before providing sensitive information
  4. For general questions, provide answers based on the available knowledge
  `;

  await axios.post('http://ollama:11434/api/create', {
    name: modelName,
    modelfile: `FROM llama2
SYSTEM "${systemPrompt}"
`
  });
}

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
    console.error('Error in add training data:', error);
    res.status(500).json({
      message: 'Error adding training data',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 