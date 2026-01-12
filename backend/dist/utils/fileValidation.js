"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeFilename = sanitizeFilename;
exports.validateFileType = validateFileType;
exports.validateFileSize = validateFileSize;
exports.checkFileContent = checkFileContent;
exports.validateFile = validateFile;
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
/**
 * Sanitizes filename to prevent path traversal and other security issues
 */
function sanitizeFilename(filename) {
    // Remove path components
    const basename = path_1.default.basename(filename);
    // Remove dangerous characters
    let sanitized = basename
        .replace(/[<>:"|?*\x00-\x1f]/g, '') // Remove invalid filename characters
        .replace(/\.\./g, '') // Remove path traversal attempts
        .replace(/^\.+/, '') // Remove leading dots
        .trim();
    // Limit filename length
    const maxLength = 255;
    if (sanitized.length > maxLength) {
        const ext = path_1.default.extname(sanitized);
        const nameWithoutExt = sanitized.slice(0, maxLength - ext.length);
        sanitized = nameWithoutExt + ext;
    }
    // Ensure filename is not empty
    if (!sanitized || sanitized.length === 0) {
        sanitized = 'unnamed_file';
    }
    return sanitized;
}
/**
 * Validates file type based on extension and MIME type
 */
function validateFileType(filename, mimetype) {
    const allowedExtensions = ['.pdf', '.txt', '.doc', '.docx', '.xls', '.xlsx', '.csv', '.json', '.xml'];
    const ext = path_1.default.extname(filename).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
        return {
            isValid: false,
            error: `Unsupported file type. Allowed types: ${allowedExtensions.join(', ')}`
        };
    }
    // Additional MIME type validation if provided
    if (mimetype) {
        const allowedMimeTypes = [
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/csv',
            'application/json',
            'application/xml',
            'text/xml'
        ];
        if (!allowedMimeTypes.includes(mimetype)) {
            return {
                isValid: false,
                error: 'File MIME type does not match file extension'
            };
        }
    }
    const sanitized = sanitizeFilename(filename);
    return {
        isValid: true,
        sanitizedFilename: sanitized
    };
}
/**
 * Validates file size
 */
function validateFileSize(fileSize, maxSize = 1000 * 1024 * 1024) {
    if (fileSize > maxSize) {
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
        return {
            isValid: false,
            error: `File size exceeds maximum allowed size of ${maxSizeMB}MB`
        };
    }
    if (fileSize === 0) {
        return {
            isValid: false,
            error: 'File is empty'
        };
    }
    return {
        isValid: true
    };
}
/**
 * Checks if file is potentially malicious by checking magic bytes
 */
async function checkFileContent(filePath, expectedExt) {
    try {
        const fileHandle = await promises_1.default.open(filePath, 'r');
        const buffer = Buffer.alloc(512); // Read first 512 bytes
        await fileHandle.read(buffer, 0, 512, 0);
        await fileHandle.close();
        // PDF magic bytes: %PDF
        if (expectedExt === '.pdf' && !buffer.toString('ascii', 0, 4).startsWith('%PDF')) {
            return {
                isValid: false,
                error: 'File content does not match PDF format'
            };
        }
        // ZIP-based formats (DOCX, XLSX) start with PK (ZIP signature)
        if (['.docx', '.xlsx'].includes(expectedExt) && buffer[0] !== 0x50 && buffer[1] !== 0x4B) {
            return {
                isValid: false,
                error: `File content does not match ${expectedExt} format`
            };
        }
        return {
            isValid: true
        };
    }
    catch (error) {
        return {
            isValid: false,
            error: 'Failed to validate file content'
        };
    }
}
/**
 * Comprehensive file validation
 */
async function validateFile(file, maxSize = 1000 * 1024 * 1024) {
    // Validate file type
    const typeValidation = validateFileType(file.originalname, file.mimetype);
    if (!typeValidation.isValid) {
        return typeValidation;
    }
    // Validate file size
    const sizeValidation = validateFileSize(file.size, maxSize);
    if (!sizeValidation.isValid) {
        return sizeValidation;
    }
    // Sanitize filename
    const sanitized = sanitizeFilename(file.originalname);
    // Check file content (optional, can be disabled for performance)
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    if (['.pdf', '.docx', '.xlsx'].includes(ext)) {
        const contentValidation = await checkFileContent(file.path, ext);
        if (!contentValidation.isValid) {
            return contentValidation;
        }
    }
    return {
        isValid: true,
        sanitizedFilename: sanitized
    };
}
