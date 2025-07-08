import { z } from 'zod';

/**
 * Vector Embeddings Schemas
 * Comprehensive type safety for embedding operations
 */

// Base embedding vector schema
export const EmbeddingVectorSchema = z.array(z.number())
  .min(1, 'Embedding vector must not be empty')
  .max(4096, 'Embedding vector too large');

// Embedding metadata schema
export const EmbeddingMetadataSchema = z.object({
  documentId: z.string().uuid().optional(),
  collectionId: z.string().uuid().optional(),
  chunkIndex: z.number().min(0).optional(),
  totalChunks: z.number().min(1).optional(),
  filename: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().min(0).optional(),
  page: z.number().min(1).optional(),
  uploadedBy: z.string().optional(),
  uploadedAt: z.string().datetime().optional(),
  characters: z.number().min(0).optional(),
  language: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
  customMetadata: z.record(z.string(), z.unknown()).optional(),
});

// Single embedding document schema
export const EmbeddingDocumentSchema = z.object({
  id: z.string().uuid('Invalid document ID'),
  text: z.string().min(1, 'Text content required').max(10000, 'Text too long'),
  embedding: EmbeddingVectorSchema,
  metadata: EmbeddingMetadataSchema.optional(),
  timestamp: z.string().datetime().optional(),
  similarity: z.number().min(0).max(1).optional(),
});

// Batch embedding request schema
export const BatchEmbeddingRequestSchema = z.object({
  texts: z.array(z.string().min(1, 'Text cannot be empty'))
    .min(1, 'At least one text required')
    .max(100, 'Maximum 100 texts per batch'),
  modelId: z.string().default('amazon.titan-embed-text-v1'),
  collectionId: z.string().uuid().optional(),
  metadata: EmbeddingMetadataSchema.optional(),
  preprocessOptions: z.object({
    truncate: z.boolean().default(true),
    normalize: z.boolean().default(false),
    removeSpecialChars: z.boolean().default(false),
    maxLength: z.number().min(1).max(10000).default(2000),
  }).optional(),
});

// Embedding response schema
export const EmbeddingResponseSchema = z.object({
  success: z.boolean(),
  embeddings: z.array(EmbeddingVectorSchema),
  processedTexts: z.array(z.string()),
  metadata: z.object({
    totalTexts: z.number().min(0),
    processedCount: z.number().min(0),
    failedCount: z.number().min(0),
    processingTime: z.number().min(0),
    modelId: z.string(),
    embeddingDimensions: z.number().min(1),
  }),
  errors: z.array(z.object({
    index: z.number().min(0),
    error: z.string(),
    text: z.string(),
  })).optional(),
});

// Vector search request schema
export const VectorSearchRequestSchema = z.object({
  query: z.string().min(1, 'Search query required').max(2000, 'Query too long'),
  collectionId: z.string().uuid('Invalid collection ID'),
  topK: z.number().min(1).max(100).default(10),
  minSimilarity: z.number().min(0).max(1).default(0.7),
  filters: z.object({
    documentId: z.string().uuid().optional(),
    fileType: z.string().optional(),
    uploadedBy: z.string().optional(),
    dateRange: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    }).optional(),
    tags: z.array(z.string()).optional(),
    customFilters: z.record(z.string(), z.unknown()).optional(),
  }).optional(),
  includeMetadata: z.boolean().default(true),
  includeEmbeddings: z.boolean().default(false),
});

// Vector search response schema
export const VectorSearchResponseSchema = z.object({
  results: z.array(z.object({
    document: EmbeddingDocumentSchema,
    similarity: z.number().min(0).max(1),
    rank: z.number().min(1),
  })),
  query: z.string(),
  searchMetadata: z.object({
    totalResults: z.number().min(0),
    searchTime: z.number().min(0),
    collectionId: z.string().uuid(),
    queryEmbedding: EmbeddingVectorSchema.optional(),
    appliedFilters: z.record(z.string(), z.unknown()).optional(),
  }),
  pagination: z.object({
    currentPage: z.number().min(1).default(1),
    pageSize: z.number().min(1).max(100).default(10),
    totalPages: z.number().min(0).default(0),
    hasNext: z.boolean().default(false),
    hasPrevious: z.boolean().default(false),
  }).optional(),
});

// Semantic similarity schemas
export const SemanticSimilarityRequestSchema = z.object({
  text1: z.string().min(1, 'First text required').max(2000, 'Text too long'),
  text2: z.string().min(1, 'Second text required').max(2000, 'Text too long'),
  modelId: z.string().default('amazon.titan-embed-text-v1'),
  similarityFunction: z.enum(['cosine', 'euclidean', 'dot']).default('cosine'),
});

export const SemanticSimilarityResponseSchema = z.object({
  similarity: z.number().min(0).max(1),
  text1: z.string(),
  text2: z.string(),
  embeddings: z.object({
    text1: EmbeddingVectorSchema,
    text2: EmbeddingVectorSchema,
  }).optional(),
  metadata: z.object({
    modelId: z.string(),
    processingTime: z.number().min(0),
    similarityFunction: z.string(),
  }),
});

// Batch processing schemas
export const BatchProcessingJobSchema = z.object({
  jobId: z.string().uuid(),
  collectionId: z.string().uuid(),
  status: z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
  progress: z.object({
    totalItems: z.number().min(0),
    processedItems: z.number().min(0),
    failedItems: z.number().min(0),
    percentage: z.number().min(0).max(100),
  }),
  metadata: z.object({
    createdAt: z.string().datetime(),
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    processingTime: z.number().min(0).optional(),
    submittedBy: z.string(),
    jobType: z.enum(['embedding', 'indexing', 'reprocessing']),
  }),
  results: z.object({
    successCount: z.number().min(0),
    errorCount: z.number().min(0),
    errors: z.array(z.object({
      itemId: z.string(),
      error: z.string(),
      timestamp: z.string().datetime(),
    })),
  }).optional(),
});

// Analytics schema
export const EmbeddingAnalyticsSchema = z.object({
  collectionId: z.string().uuid(),
  timeRange: z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
  }),
  metrics: z.object({
    totalEmbeddings: z.number().min(0),
    averageEmbeddingTime: z.number().min(0),
    totalProcessingTime: z.number().min(0),
    embeddingSuccessRate: z.number().min(0).max(1),
    averageTextLength: z.number().min(0),
    topDocumentTypes: z.array(z.object({
      type: z.string(),
      count: z.number().min(0),
      percentage: z.number().min(0).max(100),
    })),
    embeddingQuality: z.object({
      averageSimilarity: z.number().min(0).max(1),
      varianceScore: z.number().min(0),
      clusteringCoherence: z.number().min(0).max(1),
    }),
  }),
  performance: z.object({
    searchLatency: z.number().min(0),
    embeddingLatency: z.number().min(0),
    storageEfficiency: z.number().min(0).max(1),
    cacheHitRate: z.number().min(0).max(1),
  }),
});

// Export type definitions
export type EmbeddingVector = z.infer<typeof EmbeddingVectorSchema>;
export type EmbeddingMetadata = z.infer<typeof EmbeddingMetadataSchema>;
export type EmbeddingDocument = z.infer<typeof EmbeddingDocumentSchema>;
export type BatchEmbeddingRequest = z.infer<typeof BatchEmbeddingRequestSchema>;
export type EmbeddingResponse = z.infer<typeof EmbeddingResponseSchema>;
export type VectorSearchRequest = z.infer<typeof VectorSearchRequestSchema>;
export type VectorSearchResponse = z.infer<typeof VectorSearchResponseSchema>;
export type SemanticSimilarityRequest = z.infer<typeof SemanticSimilarityRequestSchema>;
export type SemanticSimilarityResponse = z.infer<typeof SemanticSimilarityResponseSchema>;
export type EmbeddingAnalytics = z.infer<typeof EmbeddingAnalyticsSchema>;
export type BatchProcessingJob = z.infer<typeof BatchProcessingJobSchema>; 