/**
 * Centralized constants for the Knowledge Base subsystem.
 * All KB files should import from here instead of defining their own copies.
 * 
 * Enterprise Configuration:
 * All limits are overridable via environment variables for deployment flexibility.
 */

// ── External Service URLs ──
export const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
export const GLOBAL_CHROMA_COLLECTION = 'mfulearnai-global-kb';
export const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://ocr-service:5000';
export const KNOWLEDGE_QUEUE_NAME = 'knowledge-processing';

// ── Google Sheets API (optional — enables multi-sheet tab reading) ──
// Free API key from Google Cloud Console → APIs & Services → Credentials
// Enable "Google Sheets API" in the project. No OAuth needed for shared sheets.
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

// ── Upload Limits ──
// Default lowered to 50MB to align with frontend and gateway limits
export const MAX_FILE_SIZE_BYTES = parseInt(process.env.KB_MAX_FILE_SIZE_MB || '50', 10) * 1024 * 1024;
export const MAX_FILES_PER_UPLOAD = parseInt(process.env.KB_MAX_FILES_PER_UPLOAD || '10', 10);
export const MAX_EXTRACT_FILE_SIZE = parseInt(process.env.KB_MAX_EXTRACT_SIZE_MB || '20', 10) * 1024 * 1024;

// ── Per-User Concurrency ──
export const MAX_CONCURRENT_UPLOADS_PER_USER = parseInt(process.env.KB_MAX_CONCURRENT_PER_USER || '5', 10);
export const MAX_PENDING_JOBS_PER_USER = parseInt(process.env.KB_MAX_PENDING_PER_USER || '20', 10);

// ── Processing Pipeline ──
export const WORKER_CONCURRENCY = parseInt(process.env.KB_WORKER_CONCURRENCY || '3', 10);
export const CHUNK_SIZE = parseInt(process.env.KB_CHUNK_SIZE || '1000', 10);
export const CHUNK_OVERLAP = parseInt(process.env.KB_CHUNK_OVERLAP || '200', 10);
export const MAX_RETRY_ATTEMPTS = parseInt(process.env.KB_MAX_RETRY || '3', 10);
export const RETRY_BACKOFF_MS = parseInt(process.env.KB_RETRY_BACKOFF_MS || '30000', 10); // 30s base
export const JOB_TIMEOUT_MS = parseInt(process.env.KB_JOB_TIMEOUT_MS || '600000', 10); // 10 min

// ── Rate Limiting (knowledge-specific) ──
export const UPLOAD_RATE_LIMIT = parseInt(process.env.KB_UPLOAD_RATE_LIMIT || '10', 10); // uploads per window
export const UPLOAD_RATE_WINDOW_MS = parseInt(process.env.KB_UPLOAD_RATE_WINDOW_MS || '300000', 10); // 5 min

// ── File Validation ──
export const ALLOWED_MIME_TYPES = new Set([
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/rtf',
    // Spreadsheets
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    // Text & Code (text/* is handled by prefix check)
    'text/plain', 'text/markdown', 'text/html', 'text/css',
    'text/javascript', 'application/javascript', 'application/json',
    'application/xml', 'text/xml', 'text/yaml',
    // Images (for OCR)
    'image/png', 'image/jpeg', 'image/tiff',
]);

export const ALLOWED_EXTENSIONS = new Set([
    'pdf', 'doc', 'docx', 'rtf',
    'xls', 'xlsx', 'csv',
    'txt', 'md', 'html', 'css', 'js', 'ts', 'json', 'xml', 'yaml', 'yml',
    'py', 'c', 'cpp', 'h', 'java', 'go', 'rs', 'php', 'rb', 'sh',
    'png', 'jpg', 'jpeg', 'tiff'
]);

// ── Dangerous File Signatures (blocked even if extension is spoofed) ──
export const BLOCKED_MAGIC_BYTES: Array<{ bytes: number[], description: string }> = [
    { bytes: [0x4D, 0x5A], description: 'Windows Executable (EXE/DLL)' },
    { bytes: [0x7F, 0x45, 0x4C, 0x46], description: 'Linux Executable (ELF)' },
    { bytes: [0x23, 0x21], description: 'Shell Script (#!)' },
    { bytes: [0xCA, 0xFE, 0xBA, 0xBE], description: 'Java Class File' },
    { bytes: [0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x08, 0x08], description: 'Potential JAR/WAR Archive' },
];

// ── Polling & Frontend ──
export const POLL_INTERVAL_MS = parseInt(process.env.KB_POLL_INTERVAL_MS || '5000', 10);
