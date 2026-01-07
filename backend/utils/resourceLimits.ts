/**
 * Resource limits and quota management
 */

export interface ResourceLimits {
  maxFileSize: number;
  maxChunksPerFile: number;
  maxFilesPerCollection: number;
  maxCollectionsPerUser: number;
  maxDailyUploads: number;
  maxMemoryUsage: number;
}

export const DEFAULT_LIMITS: ResourceLimits = {
  maxFileSize: 1000 * 1024 * 1024, // 
  maxChunksPerFile: 1000,
  maxFilesPerCollection: 100,
  maxCollectionsPerUser: 50,
  maxDailyUploads: 20,
  maxMemoryUsage: 500 * 1024 * 1024 // 500MB
};

export const STUDENT_LIMITS: ResourceLimits = {
  maxFileSize: 1000 * 1024 * 1024, // 
  maxChunksPerFile: 500,
  maxFilesPerCollection: 50,
  maxCollectionsPerUser: 20,
  maxDailyUploads: 10,
  maxMemoryUsage: 200 * 1024 * 1024 // 200MB
};

export const STAFF_LIMITS: ResourceLimits = {
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
export function getLimitsForRole(role: string): ResourceLimits {
  switch (role) {
    case 'Students':
      return STUDENT_LIMITS;
    case 'Staffs':
    case 'Admin':
      return STAFF_LIMITS;
    case 'SuperAdmin':
      return DEFAULT_LIMITS;
    default:
      return STUDENT_LIMITS;
  }
}

/**
 * Check if chunk count exceeds limit
 */
export function validateChunkCount(chunkCount: number, limit: number): { valid: boolean; error?: string } {
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
export function estimateMemoryUsage(fileSize: number, estimatedChunks: number): number {
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
