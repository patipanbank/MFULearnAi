/**
 * Centralized constants for the Knowledge Base subsystem.
 * All KB files should import from here instead of defining their own copies.
 */

export const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
export const GLOBAL_CHROMA_COLLECTION = 'mfulearnai-global-kb';
export const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://ocr-service:5000';
export const KNOWLEDGE_QUEUE_NAME = 'knowledge-processing';
