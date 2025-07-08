"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingAnalyticsSchema = exports.BatchProcessingJobSchema = exports.SemanticSimilarityResponseSchema = exports.SemanticSimilarityRequestSchema = exports.VectorSearchResponseSchema = exports.VectorSearchRequestSchema = exports.EmbeddingResponseSchema = exports.BatchEmbeddingRequestSchema = exports.EmbeddingDocumentSchema = exports.EmbeddingMetadataSchema = exports.EmbeddingVectorSchema = void 0;
const zod_1 = require("zod");
exports.EmbeddingVectorSchema = zod_1.z.array(zod_1.z.number())
    .min(1, 'Embedding vector must not be empty')
    .max(4096, 'Embedding vector too large');
exports.EmbeddingMetadataSchema = zod_1.z.object({
    documentId: zod_1.z.string().uuid().optional(),
    collectionId: zod_1.z.string().uuid().optional(),
    chunkIndex: zod_1.z.number().min(0).optional(),
    totalChunks: zod_1.z.number().min(1).optional(),
    filename: zod_1.z.string().optional(),
    fileType: zod_1.z.string().optional(),
    fileSize: zod_1.z.number().min(0).optional(),
    page: zod_1.z.number().min(1).optional(),
    uploadedBy: zod_1.z.string().optional(),
    uploadedAt: zod_1.z.string().datetime().optional(),
    characters: zod_1.z.number().min(0).optional(),
    language: zod_1.z.string().optional(),
    source: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    customMetadata: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
exports.EmbeddingDocumentSchema = zod_1.z.object({
    id: zod_1.z.string().uuid('Invalid document ID'),
    text: zod_1.z.string().min(1, 'Text content required').max(10000, 'Text too long'),
    embedding: exports.EmbeddingVectorSchema,
    metadata: exports.EmbeddingMetadataSchema.optional(),
    timestamp: zod_1.z.string().datetime().optional(),
    similarity: zod_1.z.number().min(0).max(1).optional(),
});
exports.BatchEmbeddingRequestSchema = zod_1.z.object({
    texts: zod_1.z.array(zod_1.z.string().min(1, 'Text cannot be empty'))
        .min(1, 'At least one text required')
        .max(100, 'Maximum 100 texts per batch'),
    modelId: zod_1.z.string().default('amazon.titan-embed-text-v1'),
    collectionId: zod_1.z.string().uuid().optional(),
    metadata: exports.EmbeddingMetadataSchema.optional(),
    preprocessOptions: zod_1.z.object({
        truncate: zod_1.z.boolean().default(true),
        normalize: zod_1.z.boolean().default(false),
        removeSpecialChars: zod_1.z.boolean().default(false),
        maxLength: zod_1.z.number().min(1).max(10000).default(2000),
    }).optional(),
});
exports.EmbeddingResponseSchema = zod_1.z.object({
    success: zod_1.z.boolean(),
    embeddings: zod_1.z.array(exports.EmbeddingVectorSchema),
    processedTexts: zod_1.z.array(zod_1.z.string()),
    metadata: zod_1.z.object({
        totalTexts: zod_1.z.number().min(0),
        processedCount: zod_1.z.number().min(0),
        failedCount: zod_1.z.number().min(0),
        processingTime: zod_1.z.number().min(0),
        modelId: zod_1.z.string(),
        embeddingDimensions: zod_1.z.number().min(1),
    }),
    errors: zod_1.z.array(zod_1.z.object({
        index: zod_1.z.number().min(0),
        error: zod_1.z.string(),
        text: zod_1.z.string(),
    })).optional(),
});
exports.VectorSearchRequestSchema = zod_1.z.object({
    query: zod_1.z.string().min(1, 'Search query required').max(2000, 'Query too long'),
    collectionId: zod_1.z.string().uuid('Invalid collection ID'),
    topK: zod_1.z.number().min(1).max(100).default(10),
    minSimilarity: zod_1.z.number().min(0).max(1).default(0.7),
    filters: zod_1.z.object({
        documentId: zod_1.z.string().uuid().optional(),
        fileType: zod_1.z.string().optional(),
        uploadedBy: zod_1.z.string().optional(),
        dateRange: zod_1.z.object({
            start: zod_1.z.string().datetime(),
            end: zod_1.z.string().datetime(),
        }).optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        customFilters: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    }).optional(),
    includeMetadata: zod_1.z.boolean().default(true),
    includeEmbeddings: zod_1.z.boolean().default(false),
});
exports.VectorSearchResponseSchema = zod_1.z.object({
    results: zod_1.z.array(zod_1.z.object({
        document: exports.EmbeddingDocumentSchema,
        similarity: zod_1.z.number().min(0).max(1),
        rank: zod_1.z.number().min(1),
    })),
    query: zod_1.z.string(),
    searchMetadata: zod_1.z.object({
        totalResults: zod_1.z.number().min(0),
        searchTime: zod_1.z.number().min(0),
        collectionId: zod_1.z.string().uuid(),
        queryEmbedding: exports.EmbeddingVectorSchema.optional(),
        appliedFilters: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
    }),
    pagination: zod_1.z.object({
        currentPage: zod_1.z.number().min(1).default(1),
        pageSize: zod_1.z.number().min(1).max(100).default(10),
        totalPages: zod_1.z.number().min(0).default(0),
        hasNext: zod_1.z.boolean().default(false),
        hasPrevious: zod_1.z.boolean().default(false),
    }).optional(),
});
exports.SemanticSimilarityRequestSchema = zod_1.z.object({
    text1: zod_1.z.string().min(1, 'First text required').max(2000, 'Text too long'),
    text2: zod_1.z.string().min(1, 'Second text required').max(2000, 'Text too long'),
    modelId: zod_1.z.string().default('amazon.titan-embed-text-v1'),
    similarityFunction: zod_1.z.enum(['cosine', 'euclidean', 'dot']).default('cosine'),
});
exports.SemanticSimilarityResponseSchema = zod_1.z.object({
    similarity: zod_1.z.number().min(0).max(1),
    text1: zod_1.z.string(),
    text2: zod_1.z.string(),
    embeddings: zod_1.z.object({
        text1: exports.EmbeddingVectorSchema,
        text2: exports.EmbeddingVectorSchema,
    }).optional(),
    metadata: zod_1.z.object({
        modelId: zod_1.z.string(),
        processingTime: zod_1.z.number().min(0),
        similarityFunction: zod_1.z.string(),
    }),
});
exports.BatchProcessingJobSchema = zod_1.z.object({
    jobId: zod_1.z.string().uuid(),
    collectionId: zod_1.z.string().uuid(),
    status: zod_1.z.enum(['pending', 'processing', 'completed', 'failed', 'cancelled']),
    progress: zod_1.z.object({
        totalItems: zod_1.z.number().min(0),
        processedItems: zod_1.z.number().min(0),
        failedItems: zod_1.z.number().min(0),
        percentage: zod_1.z.number().min(0).max(100),
    }),
    metadata: zod_1.z.object({
        createdAt: zod_1.z.string().datetime(),
        startedAt: zod_1.z.string().datetime().optional(),
        completedAt: zod_1.z.string().datetime().optional(),
        processingTime: zod_1.z.number().min(0).optional(),
        submittedBy: zod_1.z.string(),
        jobType: zod_1.z.enum(['embedding', 'indexing', 'reprocessing']),
    }),
    results: zod_1.z.object({
        successCount: zod_1.z.number().min(0),
        errorCount: zod_1.z.number().min(0),
        errors: zod_1.z.array(zod_1.z.object({
            itemId: zod_1.z.string(),
            error: zod_1.z.string(),
            timestamp: zod_1.z.string().datetime(),
        })),
    }).optional(),
});
exports.EmbeddingAnalyticsSchema = zod_1.z.object({
    collectionId: zod_1.z.string().uuid(),
    timeRange: zod_1.z.object({
        start: zod_1.z.string().datetime(),
        end: zod_1.z.string().datetime(),
    }),
    metrics: zod_1.z.object({
        totalEmbeddings: zod_1.z.number().min(0),
        averageEmbeddingTime: zod_1.z.number().min(0),
        totalProcessingTime: zod_1.z.number().min(0),
        embeddingSuccessRate: zod_1.z.number().min(0).max(1),
        averageTextLength: zod_1.z.number().min(0),
        topDocumentTypes: zod_1.z.array(zod_1.z.object({
            type: zod_1.z.string(),
            count: zod_1.z.number().min(0),
            percentage: zod_1.z.number().min(0).max(100),
        })),
        embeddingQuality: zod_1.z.object({
            averageSimilarity: zod_1.z.number().min(0).max(1),
            varianceScore: zod_1.z.number().min(0),
            clusteringCoherence: zod_1.z.number().min(0).max(1),
        }),
    }),
    performance: zod_1.z.object({
        searchLatency: zod_1.z.number().min(0),
        embeddingLatency: zod_1.z.number().min(0),
        storageEfficiency: zod_1.z.number().min(0).max(1),
        cacheHitRate: zod_1.z.number().min(0).max(1),
    }),
});
//# sourceMappingURL=embeddings.schemas.js.map