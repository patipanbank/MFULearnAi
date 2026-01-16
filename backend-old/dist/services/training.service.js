"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processFileDocuments = processFileDocuments;
exports.checkCollectionAccess = checkCollectionAccess;
const iconv_lite_1 = __importDefault(require("iconv-lite"));
const document_1 = require("./document");
const titan_1 = require("./titan");
const textUtils_1 = require("../utils/textUtils");
const fileValidation_1 = require("../utils/fileValidation");
const dataQuality_1 = require("../utils/dataQuality");
const resourceLimits_1 = require("../utils/resourceLimits");
/**
 * Process file upload with validation and quality checks
 */
async function processFileDocuments(file, user, modelId, collectionName) {
    // Get resource limits based on user role
    const limits = (0, resourceLimits_1.getLimitsForRole)(user.role || 'Students');
    // Validate file
    const fileValidation = await (0, fileValidation_1.validateFile)(file, limits.maxFileSize);
    if (!fileValidation.isValid) {
        throw new Error(fileValidation.error || 'File validation failed');
    }
    // Decode and sanitize filename
    const originalFilename = iconv_lite_1.default.decode(Buffer.from(file.originalname, 'binary'), 'utf-8');
    const filename = fileValidation.sanitizedFilename || (0, fileValidation_1.sanitizeFilename)(originalFilename);
    // Extract text from file
    const rawText = await document_1.documentService.processFile(file);
    // Validate extracted text quality
    const textValidation = (0, dataQuality_1.validateExtractedText)(rawText, 100);
    if (!textValidation.isValid) {
        throw new Error(textValidation.error || 'Extracted text validation failed');
    }
    const text = textValidation.normalizedText || rawText;
    // Split into chunks
    const rawChunks = (0, textUtils_1.splitTextIntoChunks)(text);
    // Validate chunk count
    const chunkCountValidation = (0, resourceLimits_1.validateChunkCount)(rawChunks.length, limits.maxChunksPerFile);
    if (!chunkCountValidation.valid) {
        throw new Error(chunkCountValidation.error || 'Chunk count exceeds limit');
    }
    // Validate and normalize chunks
    const { validChunks, invalidCount, errors } = (0, dataQuality_1.validateAndNormalizeChunks)(rawChunks);
    if (validChunks.length === 0) {
        throw new Error('No valid chunks were created from the file');
    }
    if (invalidCount > 0) {
        console.warn(`Warning: ${invalidCount} invalid chunks were removed:`, errors.slice(0, 5));
    }
    // Estimate memory usage
    const estimatedMemory = (0, resourceLimits_1.estimateMemoryUsage)(file.size, validChunks.length);
    if (estimatedMemory > limits.maxMemoryUsage) {
        throw new Error(`File processing would exceed memory limit (estimated: ${(estimatedMemory / 1024 / 1024).toFixed(2)}MB, limit: ${(limits.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB)`);
    }
    // Create documents with embeddings
    const documents = await Promise.all(validChunks.map(async (chunk) => {
        const embedResult = await titan_1.titanEmbedService.embedText(chunk);
        return {
            text: chunk,
            metadata: {
                filename,
                uploadedBy: user.username,
                timestamp: new Date().toISOString(),
                modelId,
                collectionName,
            },
            embedding: embedResult,
        };
    }));
    return documents;
}
/**
 * Check if user has access to collection
 */
async function checkCollectionAccess(user, collection) {
    const userGroups = user.groups || [];
    return (userGroups.includes('Admin') ||
        userGroups.includes('SuperAdmin') ||
        collection.createdBy === (user.nameID || user.username));
}
