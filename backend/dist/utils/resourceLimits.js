"use strict";
/**
 * Resource limits and quota management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAFF_LIMITS = exports.STUDENT_LIMITS = exports.DEFAULT_LIMITS = void 0;
exports.getLimitsForRole = getLimitsForRole;
exports.validateChunkCount = validateChunkCount;
exports.estimateMemoryUsage = estimateMemoryUsage;
exports.DEFAULT_LIMITS = {
    maxFileSize: 1000 * 1024 * 1024, // 
    maxChunksPerFile: 1000,
    maxFilesPerCollection: 100,
    maxCollectionsPerUser: 50,
    maxDailyUploads: 20,
    maxMemoryUsage: 500 * 1024 * 1024 // 500MB
};
exports.STUDENT_LIMITS = {
    maxFileSize: 1000 * 1024 * 1024, // 
    maxChunksPerFile: 500,
    maxFilesPerCollection: 50,
    maxCollectionsPerUser: 20,
    maxDailyUploads: 10,
    maxMemoryUsage: 200 * 1024 * 1024 // 200MB
};
exports.STAFF_LIMITS = {
    maxFileSize: 1000 * 1024 * 1024, // 20MB
    maxChunksPerFile: 2000,
    maxFilesPerCollection: 200,
    maxCollectionsPerUser: 100,
    maxDailyUploads: 50,
    maxMemoryUsage: 1000 * 1024 * 1024 // 1GB
};
/**
 * Get resource limits based on user role
 */
function getLimitsForRole(role) {
    switch (role) {
        case 'Students':
            return exports.STUDENT_LIMITS;
        case 'Staffs':
        case 'Admin':
            return exports.STAFF_LIMITS;
        case 'SuperAdmin':
            return exports.DEFAULT_LIMITS;
        default:
            return exports.STUDENT_LIMITS;
    }
}
/**
 * Check if chunk count exceeds limit
 */
function validateChunkCount(chunkCount, limit) {
    if (chunkCount > limit) {
        return {
            valid: false,
            error: `File would create ${chunkCount} chunks, which exceeds the limit of ${limit} chunks per file`
        };
    }
    return { valid: true };
}
/**
 * Estimate memory usage for processing
 */
function estimateMemoryUsage(fileSize, estimatedChunks) {
    // Rough estimation:
    // - File size (original)
    // - Text extraction (usually 2-3x file size for PDFs)
    // - Chunks storage (estimated 2KB per chunk)
    // - Embeddings (512 dimensions * 4 bytes * chunks)
    const textSize = fileSize * 2.5;
    const chunksSize = estimatedChunks * 2 * 1024; // 2KB per chunk
    const embeddingsSize = estimatedChunks * 512 * 4; // 512 dims * 4 bytes
    return fileSize + textSize + chunksSize + embeddingsSize;
}
