import { Express } from 'express';
import iconv from 'iconv-lite';
import { documentService } from './document';
import { chromaService } from './chroma';
import { titanEmbedService } from './titan';
import { splitTextIntoChunks } from '../utils/textUtils';
import { validateFile, sanitizeFilename } from '../utils/fileValidation';
import { validateExtractedText, validateAndNormalizeChunks } from '../utils/dataQuality';
import { getLimitsForRole, validateChunkCount, estimateMemoryUsage } from '../utils/resourceLimits';
import { AuthenticatedRequest } from '../types/common';

/**
 * Process file upload with validation and quality checks
 */
export async function processFileDocuments(
  file: Express.Multer.File,
  user: AuthenticatedRequest['user'],
  modelId: string,
  collectionName: string
): Promise<{ text: string; metadata: any; embedding: number[] }[]> {
  // Get resource limits based on user role
  const limits = getLimitsForRole(user.role || 'Students');

  // Validate file
  const fileValidation = await validateFile(file, limits.maxFileSize);
  if (!fileValidation.isValid) {
    throw new Error(fileValidation.error || 'File validation failed');
  }

  // Decode and sanitize filename
  const originalFilename = iconv.decode(Buffer.from(file.originalname, 'binary'), 'utf-8');
  const filename = fileValidation.sanitizedFilename || sanitizeFilename(originalFilename);

  // Extract text from file
  const rawText = await documentService.processFile(file);

  // Validate extracted text quality
  const textValidation = validateExtractedText(rawText, 100);
  if (!textValidation.isValid) {
    throw new Error(textValidation.error || 'Extracted text validation failed');
  }

  const text = textValidation.normalizedText || rawText;

  // Split into chunks
  const rawChunks = splitTextIntoChunks(text);

  // Validate chunk count
  const chunkCountValidation = validateChunkCount(rawChunks.length, limits.maxChunksPerFile);
  if (!chunkCountValidation.valid) {
    throw new Error(chunkCountValidation.error || 'Chunk count exceeds limit');
  }

  // Validate and normalize chunks
  const { validChunks, invalidCount, errors } = validateAndNormalizeChunks(rawChunks);

  if (validChunks.length === 0) {
    throw new Error('No valid chunks were created from the file');
  }

  if (invalidCount > 0) {
    console.warn(`Warning: ${invalidCount} invalid chunks were removed:`, errors.slice(0, 5));
  }

  // Estimate memory usage
  const estimatedMemory = estimateMemoryUsage(file.size, validChunks.length);
  if (estimatedMemory > limits.maxMemoryUsage) {
    throw new Error(
      `File processing would exceed memory limit (estimated: ${(estimatedMemory / 1024 / 1024).toFixed(2)}MB, limit: ${(limits.maxMemoryUsage / 1024 / 1024).toFixed(2)}MB)`
    );
  }

  // Create documents with embeddings
  const documents = await Promise.all(
    validChunks.map(async (chunk) => {
      const embedResult = await titanEmbedService.embedText(chunk);
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
    })
  );

  return documents;
}

/**
 * Check if user has access to collection
 */
export async function checkCollectionAccess(
  user: AuthenticatedRequest['user'],
  collection: { createdBy: string }
): Promise<boolean> {
  const userGroups = user.groups || [];
  return (
    userGroups.includes('Admin') ||
    userGroups.includes('SuperAdmin') ||
    collection.createdBy === (user.nameID || user.username)
  );
}
