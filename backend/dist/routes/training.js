"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const router = express_1.default.Router();
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, CSV, XLS, XLSX files are allowed.'));
        }
    }
});
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const { collectionId } = req.body;
        if (!collectionId) {
            return res.status(400).json({ error: 'Collection ID is required' });
        }
        return res.json({
            message: 'File uploaded successfully',
            filename: req.file.originalname,
            size: req.file.size,
            collectionId: collectionId
        });
    }
    catch (error) {
        console.error('Training upload error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to upload file'
        });
    }
});
router.get('/status', async (req, res) => {
    try {
        res.json({
            status: 'idle',
            message: 'Training service is available'
        });
    }
    catch (error) {
        console.error('Training status error:', error);
        res.status(500).json({
            error: error.message || 'Failed to get training status'
        });
    }
});
exports.default = router;
//# sourceMappingURL=training.js.map