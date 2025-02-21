import express from 'express';
import multer from 'multer';
import { uploadFileController } from '../controllers/fileUploadController';

const router = express.Router();

// Configure Multer to store files in memory.
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Define a POST route for file uploads. 
// The 'file' field in the form-data is expected to contain the file.
router.post('/upload', upload.single('file'), uploadFileController);

export default router; 