"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const storageService_1 = require("../services/storageService");
const router = express_1.default.Router();
const upload = (0, multer_1.default)();
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        if (!file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        if (file.size > 10 * 1024 * 1024) {
            return res.status(400).json({ error: 'File too large (max 10 MB)' });
        }
        const url = await storageService_1.storageService.uploadFile(file.buffer, file.originalname, file.mimetype || 'application/octet-stream');
        return res.json({ url, mediaType: file.mimetype });
    }
    catch (e) {
        return res.status(500).json({ error: `Upload failed: ${e.message}` });
    }
});
exports.default = router;
//# sourceMappingURL=upload.js.map