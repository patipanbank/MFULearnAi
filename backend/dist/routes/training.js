"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const auth_1 = require("../middleware/auth");
const trainingService_1 = require("../services/trainingService");
const queueService_1 = require("../services/queueService");
const router = express_1.default.Router();
router.use(auth_1.authenticateJWT, auth_1.requireAnyRole);
const storage = multer_1.default.memoryStorage();
const upload = (0, multer_1.default)({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024,
        files: 1,
    },
    fileFilter: (req, file, cb) => {
        console.log('🔍 Multer fileFilter called:', {
            fieldname: file.fieldname,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size
        });
        const allowedMimes = [
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/csv',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/csv',
            'text/csv',
            'application/vnd.ms-excel.sheet.macroEnabled.12',
            'application/vnd.ms-excel.template.macroEnabled.12'
        ];
        if (allowedMimes.includes(file.mimetype)) {
            console.log('✅ File type allowed');
            cb(null, true);
        }
        else {
            console.log('❌ File type not allowed:', file.mimetype);
            cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, CSV, XLS, XLSX files are allowed.'));
        }
    }
});
router.post('/upload', (req, res, next) => {
    console.log('📝 Upload route called, headers:', {
        'content-type': req.headers['content-type'],
        'content-length': req.headers['content-length']
    });
    return upload.single('file')(req, res, (err) => {
        console.log('🔄 Multer finished:', {
            hasError: !!err,
            hasFile: !!req.file,
            error: err?.message
        });
        if (err) {
            console.log('❌ Multer error:', err.message);
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
            }
            return res.status(400).json({ error: err.message });
        }
        return next();
    });
}, async (req, res) => {
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
        const jwtUser = req.user;
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
        };
        const shouldUseQueue = useQueue === 'true' || req.file.size > 5 * 1024 * 1024;
        if (shouldUseQueue) {
            const jobId = await queueService_1.queueService.addFileProcessingJob(req.file.buffer, req.file.originalname, user, modelId || 'amazon.titan-embed-text-v1', collectionName);
            return res.json({
                message: 'File queued for processing',
                jobId: jobId,
                filename: req.file.originalname,
                size: req.file.size,
                collectionName: collectionName,
                modelId: modelId || 'amazon.titan-embed-text-v1',
                queued: true
            });
        }
        else {
            const chunksCount = await trainingService_1.trainingService.processAndEmbedFile(req.file.buffer, req.file.originalname, user, modelId || 'amazon.titan-embed-text-v1', collectionName);
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
    }
    catch (error) {
        console.error('❌ Training upload error:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
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
router.post('/scrape-url', async (req, res) => {
    try {
        console.log('🌐 URL scraping request:', req.body);
        const { url, collectionName, modelId } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }
        if (!collectionName) {
            return res.status(400).json({ error: 'Collection name is required' });
        }
        const jwtUser = req.user;
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
        };
        const chunksCount = await trainingService_1.trainingService.processAndEmbedUrl(url, user, modelId || 'amazon.titan-embed-text-v1', collectionName);
        return res.json({
            message: `URL scraped successfully. ${chunksCount} chunks were added.`,
            url: url,
            collectionName: collectionName,
            modelId: modelId || 'amazon.titan-embed-text-v1',
            chunks: chunksCount
        });
    }
    catch (error) {
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
router.post('/text', async (req, res) => {
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
        if (text.length > 1000000) {
            return res.status(400).json({ error: 'Text content too large (maximum 1MB)' });
        }
        const jwtUser = req.user;
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
        };
        const chunksCount = await trainingService_1.trainingService.processAndEmbedText(text, documentName, user, modelId || 'amazon.titan-embed-text-v1', collectionName);
        return res.json({
            message: `Text processed successfully. ${chunksCount} chunks were added.`,
            documentName: documentName,
            textLength: text.length,
            collectionName: collectionName,
            modelId: modelId || 'amazon.titan-embed-text-v1',
            chunks: chunksCount
        });
    }
    catch (error) {
        console.error('❌ Text processing error:', error);
        return res.status(500).json({
            error: error.message || 'Failed to process text'
        });
    }
});
exports.default = router;
//# sourceMappingURL=training.js.map