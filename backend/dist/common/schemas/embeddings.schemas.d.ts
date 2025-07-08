import { z } from 'zod';
export declare const EmbeddingVectorSchema: z.ZodArray<z.ZodNumber, "many">;
export declare const EmbeddingMetadataSchema: z.ZodObject<{
    documentId: z.ZodOptional<z.ZodString>;
    collectionId: z.ZodOptional<z.ZodString>;
    chunkIndex: z.ZodOptional<z.ZodNumber>;
    totalChunks: z.ZodOptional<z.ZodNumber>;
    filename: z.ZodOptional<z.ZodString>;
    fileType: z.ZodOptional<z.ZodString>;
    fileSize: z.ZodOptional<z.ZodNumber>;
    page: z.ZodOptional<z.ZodNumber>;
    uploadedBy: z.ZodOptional<z.ZodString>;
    uploadedAt: z.ZodOptional<z.ZodString>;
    characters: z.ZodOptional<z.ZodNumber>;
    language: z.ZodOptional<z.ZodString>;
    source: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    customMetadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "strip", z.ZodTypeAny, {
    tags?: string[] | undefined;
    filename?: string | undefined;
    page?: number | undefined;
    chunkIndex?: number | undefined;
    totalChunks?: number | undefined;
    characters?: number | undefined;
    uploadedBy?: string | undefined;
    uploadedAt?: string | undefined;
    fileType?: string | undefined;
    fileSize?: number | undefined;
    documentId?: string | undefined;
    collectionId?: string | undefined;
    language?: string | undefined;
    source?: string | undefined;
    customMetadata?: Record<string, unknown> | undefined;
}, {
    tags?: string[] | undefined;
    filename?: string | undefined;
    page?: number | undefined;
    chunkIndex?: number | undefined;
    totalChunks?: number | undefined;
    characters?: number | undefined;
    uploadedBy?: string | undefined;
    uploadedAt?: string | undefined;
    fileType?: string | undefined;
    fileSize?: number | undefined;
    documentId?: string | undefined;
    collectionId?: string | undefined;
    language?: string | undefined;
    source?: string | undefined;
    customMetadata?: Record<string, unknown> | undefined;
}>;
export declare const EmbeddingDocumentSchema: z.ZodObject<{
    id: z.ZodString;
    text: z.ZodString;
    embedding: z.ZodArray<z.ZodNumber, "many">;
    metadata: z.ZodOptional<z.ZodObject<{
        documentId: z.ZodOptional<z.ZodString>;
        collectionId: z.ZodOptional<z.ZodString>;
        chunkIndex: z.ZodOptional<z.ZodNumber>;
        totalChunks: z.ZodOptional<z.ZodNumber>;
        filename: z.ZodOptional<z.ZodString>;
        fileType: z.ZodOptional<z.ZodString>;
        fileSize: z.ZodOptional<z.ZodNumber>;
        page: z.ZodOptional<z.ZodNumber>;
        uploadedBy: z.ZodOptional<z.ZodString>;
        uploadedAt: z.ZodOptional<z.ZodString>;
        characters: z.ZodOptional<z.ZodNumber>;
        language: z.ZodOptional<z.ZodString>;
        source: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        customMetadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        tags?: string[] | undefined;
        filename?: string | undefined;
        page?: number | undefined;
        chunkIndex?: number | undefined;
        totalChunks?: number | undefined;
        characters?: number | undefined;
        uploadedBy?: string | undefined;
        uploadedAt?: string | undefined;
        fileType?: string | undefined;
        fileSize?: number | undefined;
        documentId?: string | undefined;
        collectionId?: string | undefined;
        language?: string | undefined;
        source?: string | undefined;
        customMetadata?: Record<string, unknown> | undefined;
    }, {
        tags?: string[] | undefined;
        filename?: string | undefined;
        page?: number | undefined;
        chunkIndex?: number | undefined;
        totalChunks?: number | undefined;
        characters?: number | undefined;
        uploadedBy?: string | undefined;
        uploadedAt?: string | undefined;
        fileType?: string | undefined;
        fileSize?: number | undefined;
        documentId?: string | undefined;
        collectionId?: string | undefined;
        language?: string | undefined;
        source?: string | undefined;
        customMetadata?: Record<string, unknown> | undefined;
    }>>;
    timestamp: z.ZodOptional<z.ZodString>;
    similarity: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    text: string;
    id: string;
    embedding: number[];
    timestamp?: string | undefined;
    metadata?: {
        tags?: string[] | undefined;
        filename?: string | undefined;
        page?: number | undefined;
        chunkIndex?: number | undefined;
        totalChunks?: number | undefined;
        characters?: number | undefined;
        uploadedBy?: string | undefined;
        uploadedAt?: string | undefined;
        fileType?: string | undefined;
        fileSize?: number | undefined;
        documentId?: string | undefined;
        collectionId?: string | undefined;
        language?: string | undefined;
        source?: string | undefined;
        customMetadata?: Record<string, unknown> | undefined;
    } | undefined;
    similarity?: number | undefined;
}, {
    text: string;
    id: string;
    embedding: number[];
    timestamp?: string | undefined;
    metadata?: {
        tags?: string[] | undefined;
        filename?: string | undefined;
        page?: number | undefined;
        chunkIndex?: number | undefined;
        totalChunks?: number | undefined;
        characters?: number | undefined;
        uploadedBy?: string | undefined;
        uploadedAt?: string | undefined;
        fileType?: string | undefined;
        fileSize?: number | undefined;
        documentId?: string | undefined;
        collectionId?: string | undefined;
        language?: string | undefined;
        source?: string | undefined;
        customMetadata?: Record<string, unknown> | undefined;
    } | undefined;
    similarity?: number | undefined;
}>;
export declare const BatchEmbeddingRequestSchema: z.ZodObject<{
    texts: z.ZodArray<z.ZodString, "many">;
    modelId: z.ZodDefault<z.ZodString>;
    collectionId: z.ZodOptional<z.ZodString>;
    metadata: z.ZodOptional<z.ZodObject<{
        documentId: z.ZodOptional<z.ZodString>;
        collectionId: z.ZodOptional<z.ZodString>;
        chunkIndex: z.ZodOptional<z.ZodNumber>;
        totalChunks: z.ZodOptional<z.ZodNumber>;
        filename: z.ZodOptional<z.ZodString>;
        fileType: z.ZodOptional<z.ZodString>;
        fileSize: z.ZodOptional<z.ZodNumber>;
        page: z.ZodOptional<z.ZodNumber>;
        uploadedBy: z.ZodOptional<z.ZodString>;
        uploadedAt: z.ZodOptional<z.ZodString>;
        characters: z.ZodOptional<z.ZodNumber>;
        language: z.ZodOptional<z.ZodString>;
        source: z.ZodOptional<z.ZodString>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        customMetadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        tags?: string[] | undefined;
        filename?: string | undefined;
        page?: number | undefined;
        chunkIndex?: number | undefined;
        totalChunks?: number | undefined;
        characters?: number | undefined;
        uploadedBy?: string | undefined;
        uploadedAt?: string | undefined;
        fileType?: string | undefined;
        fileSize?: number | undefined;
        documentId?: string | undefined;
        collectionId?: string | undefined;
        language?: string | undefined;
        source?: string | undefined;
        customMetadata?: Record<string, unknown> | undefined;
    }, {
        tags?: string[] | undefined;
        filename?: string | undefined;
        page?: number | undefined;
        chunkIndex?: number | undefined;
        totalChunks?: number | undefined;
        characters?: number | undefined;
        uploadedBy?: string | undefined;
        uploadedAt?: string | undefined;
        fileType?: string | undefined;
        fileSize?: number | undefined;
        documentId?: string | undefined;
        collectionId?: string | undefined;
        language?: string | undefined;
        source?: string | undefined;
        customMetadata?: Record<string, unknown> | undefined;
    }>>;
    preprocessOptions: z.ZodOptional<z.ZodObject<{
        truncate: z.ZodDefault<z.ZodBoolean>;
        normalize: z.ZodDefault<z.ZodBoolean>;
        removeSpecialChars: z.ZodDefault<z.ZodBoolean>;
        maxLength: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        normalize: boolean;
        truncate: boolean;
        removeSpecialChars: boolean;
        maxLength: number;
    }, {
        normalize?: boolean | undefined;
        truncate?: boolean | undefined;
        removeSpecialChars?: boolean | undefined;
        maxLength?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    modelId: string;
    texts: string[];
    metadata?: {
        tags?: string[] | undefined;
        filename?: string | undefined;
        page?: number | undefined;
        chunkIndex?: number | undefined;
        totalChunks?: number | undefined;
        characters?: number | undefined;
        uploadedBy?: string | undefined;
        uploadedAt?: string | undefined;
        fileType?: string | undefined;
        fileSize?: number | undefined;
        documentId?: string | undefined;
        collectionId?: string | undefined;
        language?: string | undefined;
        source?: string | undefined;
        customMetadata?: Record<string, unknown> | undefined;
    } | undefined;
    collectionId?: string | undefined;
    preprocessOptions?: {
        normalize: boolean;
        truncate: boolean;
        removeSpecialChars: boolean;
        maxLength: number;
    } | undefined;
}, {
    texts: string[];
    metadata?: {
        tags?: string[] | undefined;
        filename?: string | undefined;
        page?: number | undefined;
        chunkIndex?: number | undefined;
        totalChunks?: number | undefined;
        characters?: number | undefined;
        uploadedBy?: string | undefined;
        uploadedAt?: string | undefined;
        fileType?: string | undefined;
        fileSize?: number | undefined;
        documentId?: string | undefined;
        collectionId?: string | undefined;
        language?: string | undefined;
        source?: string | undefined;
        customMetadata?: Record<string, unknown> | undefined;
    } | undefined;
    modelId?: string | undefined;
    collectionId?: string | undefined;
    preprocessOptions?: {
        normalize?: boolean | undefined;
        truncate?: boolean | undefined;
        removeSpecialChars?: boolean | undefined;
        maxLength?: number | undefined;
    } | undefined;
}>;
export declare const EmbeddingResponseSchema: z.ZodObject<{
    success: z.ZodBoolean;
    embeddings: z.ZodArray<z.ZodArray<z.ZodNumber, "many">, "many">;
    processedTexts: z.ZodArray<z.ZodString, "many">;
    metadata: z.ZodObject<{
        totalTexts: z.ZodNumber;
        processedCount: z.ZodNumber;
        failedCount: z.ZodNumber;
        processingTime: z.ZodNumber;
        modelId: z.ZodString;
        embeddingDimensions: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        modelId: string;
        totalTexts: number;
        processedCount: number;
        failedCount: number;
        processingTime: number;
        embeddingDimensions: number;
    }, {
        modelId: string;
        totalTexts: number;
        processedCount: number;
        failedCount: number;
        processingTime: number;
        embeddingDimensions: number;
    }>;
    errors: z.ZodOptional<z.ZodArray<z.ZodObject<{
        index: z.ZodNumber;
        error: z.ZodString;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        error: string;
        text: string;
        index: number;
    }, {
        error: string;
        text: string;
        index: number;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    metadata: {
        modelId: string;
        totalTexts: number;
        processedCount: number;
        failedCount: number;
        processingTime: number;
        embeddingDimensions: number;
    };
    embeddings: number[][];
    success: boolean;
    processedTexts: string[];
    errors?: {
        error: string;
        text: string;
        index: number;
    }[] | undefined;
}, {
    metadata: {
        modelId: string;
        totalTexts: number;
        processedCount: number;
        failedCount: number;
        processingTime: number;
        embeddingDimensions: number;
    };
    embeddings: number[][];
    success: boolean;
    processedTexts: string[];
    errors?: {
        error: string;
        text: string;
        index: number;
    }[] | undefined;
}>;
export declare const VectorSearchRequestSchema: z.ZodObject<{
    query: z.ZodString;
    collectionId: z.ZodString;
    topK: z.ZodDefault<z.ZodNumber>;
    minSimilarity: z.ZodDefault<z.ZodNumber>;
    filters: z.ZodOptional<z.ZodObject<{
        documentId: z.ZodOptional<z.ZodString>;
        fileType: z.ZodOptional<z.ZodString>;
        uploadedBy: z.ZodOptional<z.ZodString>;
        dateRange: z.ZodOptional<z.ZodObject<{
            start: z.ZodString;
            end: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            end: string;
            start: string;
        }, {
            end: string;
            start: string;
        }>>;
        tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        customFilters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        tags?: string[] | undefined;
        uploadedBy?: string | undefined;
        fileType?: string | undefined;
        documentId?: string | undefined;
        dateRange?: {
            end: string;
            start: string;
        } | undefined;
        customFilters?: Record<string, unknown> | undefined;
    }, {
        tags?: string[] | undefined;
        uploadedBy?: string | undefined;
        fileType?: string | undefined;
        documentId?: string | undefined;
        dateRange?: {
            end: string;
            start: string;
        } | undefined;
        customFilters?: Record<string, unknown> | undefined;
    }>>;
    includeMetadata: z.ZodDefault<z.ZodBoolean>;
    includeEmbeddings: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    collectionId: string;
    query: string;
    topK: number;
    minSimilarity: number;
    includeMetadata: boolean;
    includeEmbeddings: boolean;
    filters?: {
        tags?: string[] | undefined;
        uploadedBy?: string | undefined;
        fileType?: string | undefined;
        documentId?: string | undefined;
        dateRange?: {
            end: string;
            start: string;
        } | undefined;
        customFilters?: Record<string, unknown> | undefined;
    } | undefined;
}, {
    collectionId: string;
    query: string;
    topK?: number | undefined;
    minSimilarity?: number | undefined;
    filters?: {
        tags?: string[] | undefined;
        uploadedBy?: string | undefined;
        fileType?: string | undefined;
        documentId?: string | undefined;
        dateRange?: {
            end: string;
            start: string;
        } | undefined;
        customFilters?: Record<string, unknown> | undefined;
    } | undefined;
    includeMetadata?: boolean | undefined;
    includeEmbeddings?: boolean | undefined;
}>;
export declare const VectorSearchResponseSchema: z.ZodObject<{
    results: z.ZodArray<z.ZodObject<{
        document: z.ZodObject<{
            id: z.ZodString;
            text: z.ZodString;
            embedding: z.ZodArray<z.ZodNumber, "many">;
            metadata: z.ZodOptional<z.ZodObject<{
                documentId: z.ZodOptional<z.ZodString>;
                collectionId: z.ZodOptional<z.ZodString>;
                chunkIndex: z.ZodOptional<z.ZodNumber>;
                totalChunks: z.ZodOptional<z.ZodNumber>;
                filename: z.ZodOptional<z.ZodString>;
                fileType: z.ZodOptional<z.ZodString>;
                fileSize: z.ZodOptional<z.ZodNumber>;
                page: z.ZodOptional<z.ZodNumber>;
                uploadedBy: z.ZodOptional<z.ZodString>;
                uploadedAt: z.ZodOptional<z.ZodString>;
                characters: z.ZodOptional<z.ZodNumber>;
                language: z.ZodOptional<z.ZodString>;
                source: z.ZodOptional<z.ZodString>;
                tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                customMetadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            }, "strip", z.ZodTypeAny, {
                tags?: string[] | undefined;
                filename?: string | undefined;
                page?: number | undefined;
                chunkIndex?: number | undefined;
                totalChunks?: number | undefined;
                characters?: number | undefined;
                uploadedBy?: string | undefined;
                uploadedAt?: string | undefined;
                fileType?: string | undefined;
                fileSize?: number | undefined;
                documentId?: string | undefined;
                collectionId?: string | undefined;
                language?: string | undefined;
                source?: string | undefined;
                customMetadata?: Record<string, unknown> | undefined;
            }, {
                tags?: string[] | undefined;
                filename?: string | undefined;
                page?: number | undefined;
                chunkIndex?: number | undefined;
                totalChunks?: number | undefined;
                characters?: number | undefined;
                uploadedBy?: string | undefined;
                uploadedAt?: string | undefined;
                fileType?: string | undefined;
                fileSize?: number | undefined;
                documentId?: string | undefined;
                collectionId?: string | undefined;
                language?: string | undefined;
                source?: string | undefined;
                customMetadata?: Record<string, unknown> | undefined;
            }>>;
            timestamp: z.ZodOptional<z.ZodString>;
            similarity: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            text: string;
            id: string;
            embedding: number[];
            timestamp?: string | undefined;
            metadata?: {
                tags?: string[] | undefined;
                filename?: string | undefined;
                page?: number | undefined;
                chunkIndex?: number | undefined;
                totalChunks?: number | undefined;
                characters?: number | undefined;
                uploadedBy?: string | undefined;
                uploadedAt?: string | undefined;
                fileType?: string | undefined;
                fileSize?: number | undefined;
                documentId?: string | undefined;
                collectionId?: string | undefined;
                language?: string | undefined;
                source?: string | undefined;
                customMetadata?: Record<string, unknown> | undefined;
            } | undefined;
            similarity?: number | undefined;
        }, {
            text: string;
            id: string;
            embedding: number[];
            timestamp?: string | undefined;
            metadata?: {
                tags?: string[] | undefined;
                filename?: string | undefined;
                page?: number | undefined;
                chunkIndex?: number | undefined;
                totalChunks?: number | undefined;
                characters?: number | undefined;
                uploadedBy?: string | undefined;
                uploadedAt?: string | undefined;
                fileType?: string | undefined;
                fileSize?: number | undefined;
                documentId?: string | undefined;
                collectionId?: string | undefined;
                language?: string | undefined;
                source?: string | undefined;
                customMetadata?: Record<string, unknown> | undefined;
            } | undefined;
            similarity?: number | undefined;
        }>;
        similarity: z.ZodNumber;
        rank: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        document: {
            text: string;
            id: string;
            embedding: number[];
            timestamp?: string | undefined;
            metadata?: {
                tags?: string[] | undefined;
                filename?: string | undefined;
                page?: number | undefined;
                chunkIndex?: number | undefined;
                totalChunks?: number | undefined;
                characters?: number | undefined;
                uploadedBy?: string | undefined;
                uploadedAt?: string | undefined;
                fileType?: string | undefined;
                fileSize?: number | undefined;
                documentId?: string | undefined;
                collectionId?: string | undefined;
                language?: string | undefined;
                source?: string | undefined;
                customMetadata?: Record<string, unknown> | undefined;
            } | undefined;
            similarity?: number | undefined;
        };
        similarity: number;
        rank: number;
    }, {
        document: {
            text: string;
            id: string;
            embedding: number[];
            timestamp?: string | undefined;
            metadata?: {
                tags?: string[] | undefined;
                filename?: string | undefined;
                page?: number | undefined;
                chunkIndex?: number | undefined;
                totalChunks?: number | undefined;
                characters?: number | undefined;
                uploadedBy?: string | undefined;
                uploadedAt?: string | undefined;
                fileType?: string | undefined;
                fileSize?: number | undefined;
                documentId?: string | undefined;
                collectionId?: string | undefined;
                language?: string | undefined;
                source?: string | undefined;
                customMetadata?: Record<string, unknown> | undefined;
            } | undefined;
            similarity?: number | undefined;
        };
        similarity: number;
        rank: number;
    }>, "many">;
    query: z.ZodString;
    searchMetadata: z.ZodObject<{
        totalResults: z.ZodNumber;
        searchTime: z.ZodNumber;
        collectionId: z.ZodString;
        queryEmbedding: z.ZodOptional<z.ZodArray<z.ZodNumber, "many">>;
        appliedFilters: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        collectionId: string;
        totalResults: number;
        searchTime: number;
        queryEmbedding?: number[] | undefined;
        appliedFilters?: Record<string, unknown> | undefined;
    }, {
        collectionId: string;
        totalResults: number;
        searchTime: number;
        queryEmbedding?: number[] | undefined;
        appliedFilters?: Record<string, unknown> | undefined;
    }>;
    pagination: z.ZodOptional<z.ZodObject<{
        currentPage: z.ZodDefault<z.ZodNumber>;
        pageSize: z.ZodDefault<z.ZodNumber>;
        totalPages: z.ZodDefault<z.ZodNumber>;
        hasNext: z.ZodDefault<z.ZodBoolean>;
        hasPrevious: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        currentPage: number;
        pageSize: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
    }, {
        currentPage?: number | undefined;
        pageSize?: number | undefined;
        totalPages?: number | undefined;
        hasNext?: boolean | undefined;
        hasPrevious?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    query: string;
    results: {
        document: {
            text: string;
            id: string;
            embedding: number[];
            timestamp?: string | undefined;
            metadata?: {
                tags?: string[] | undefined;
                filename?: string | undefined;
                page?: number | undefined;
                chunkIndex?: number | undefined;
                totalChunks?: number | undefined;
                characters?: number | undefined;
                uploadedBy?: string | undefined;
                uploadedAt?: string | undefined;
                fileType?: string | undefined;
                fileSize?: number | undefined;
                documentId?: string | undefined;
                collectionId?: string | undefined;
                language?: string | undefined;
                source?: string | undefined;
                customMetadata?: Record<string, unknown> | undefined;
            } | undefined;
            similarity?: number | undefined;
        };
        similarity: number;
        rank: number;
    }[];
    searchMetadata: {
        collectionId: string;
        totalResults: number;
        searchTime: number;
        queryEmbedding?: number[] | undefined;
        appliedFilters?: Record<string, unknown> | undefined;
    };
    pagination?: {
        currentPage: number;
        pageSize: number;
        totalPages: number;
        hasNext: boolean;
        hasPrevious: boolean;
    } | undefined;
}, {
    query: string;
    results: {
        document: {
            text: string;
            id: string;
            embedding: number[];
            timestamp?: string | undefined;
            metadata?: {
                tags?: string[] | undefined;
                filename?: string | undefined;
                page?: number | undefined;
                chunkIndex?: number | undefined;
                totalChunks?: number | undefined;
                characters?: number | undefined;
                uploadedBy?: string | undefined;
                uploadedAt?: string | undefined;
                fileType?: string | undefined;
                fileSize?: number | undefined;
                documentId?: string | undefined;
                collectionId?: string | undefined;
                language?: string | undefined;
                source?: string | undefined;
                customMetadata?: Record<string, unknown> | undefined;
            } | undefined;
            similarity?: number | undefined;
        };
        similarity: number;
        rank: number;
    }[];
    searchMetadata: {
        collectionId: string;
        totalResults: number;
        searchTime: number;
        queryEmbedding?: number[] | undefined;
        appliedFilters?: Record<string, unknown> | undefined;
    };
    pagination?: {
        currentPage?: number | undefined;
        pageSize?: number | undefined;
        totalPages?: number | undefined;
        hasNext?: boolean | undefined;
        hasPrevious?: boolean | undefined;
    } | undefined;
}>;
export declare const SemanticSimilarityRequestSchema: z.ZodObject<{
    text1: z.ZodString;
    text2: z.ZodString;
    modelId: z.ZodDefault<z.ZodString>;
    similarityFunction: z.ZodDefault<z.ZodEnum<["cosine", "euclidean", "dot"]>>;
}, "strip", z.ZodTypeAny, {
    modelId: string;
    text1: string;
    text2: string;
    similarityFunction: "cosine" | "euclidean" | "dot";
}, {
    text1: string;
    text2: string;
    modelId?: string | undefined;
    similarityFunction?: "cosine" | "euclidean" | "dot" | undefined;
}>;
export declare const SemanticSimilarityResponseSchema: z.ZodObject<{
    similarity: z.ZodNumber;
    text1: z.ZodString;
    text2: z.ZodString;
    embeddings: z.ZodOptional<z.ZodObject<{
        text1: z.ZodArray<z.ZodNumber, "many">;
        text2: z.ZodArray<z.ZodNumber, "many">;
    }, "strip", z.ZodTypeAny, {
        text1: number[];
        text2: number[];
    }, {
        text1: number[];
        text2: number[];
    }>>;
    metadata: z.ZodObject<{
        modelId: z.ZodString;
        processingTime: z.ZodNumber;
        similarityFunction: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        modelId: string;
        processingTime: number;
        similarityFunction: string;
    }, {
        modelId: string;
        processingTime: number;
        similarityFunction: string;
    }>;
}, "strip", z.ZodTypeAny, {
    metadata: {
        modelId: string;
        processingTime: number;
        similarityFunction: string;
    };
    similarity: number;
    text1: string;
    text2: string;
    embeddings?: {
        text1: number[];
        text2: number[];
    } | undefined;
}, {
    metadata: {
        modelId: string;
        processingTime: number;
        similarityFunction: string;
    };
    similarity: number;
    text1: string;
    text2: string;
    embeddings?: {
        text1: number[];
        text2: number[];
    } | undefined;
}>;
export declare const BatchProcessingJobSchema: z.ZodObject<{
    jobId: z.ZodString;
    collectionId: z.ZodString;
    status: z.ZodEnum<["pending", "processing", "completed", "failed", "cancelled"]>;
    progress: z.ZodObject<{
        totalItems: z.ZodNumber;
        processedItems: z.ZodNumber;
        failedItems: z.ZodNumber;
        percentage: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalItems: number;
        processedItems: number;
        failedItems: number;
        percentage: number;
    }, {
        totalItems: number;
        processedItems: number;
        failedItems: number;
        percentage: number;
    }>;
    metadata: z.ZodObject<{
        createdAt: z.ZodString;
        startedAt: z.ZodOptional<z.ZodString>;
        completedAt: z.ZodOptional<z.ZodString>;
        processingTime: z.ZodOptional<z.ZodNumber>;
        submittedBy: z.ZodString;
        jobType: z.ZodEnum<["embedding", "indexing", "reprocessing"]>;
    }, "strip", z.ZodTypeAny, {
        createdAt: string;
        submittedBy: string;
        jobType: "embedding" | "indexing" | "reprocessing";
        processingTime?: number | undefined;
        startedAt?: string | undefined;
        completedAt?: string | undefined;
    }, {
        createdAt: string;
        submittedBy: string;
        jobType: "embedding" | "indexing" | "reprocessing";
        processingTime?: number | undefined;
        startedAt?: string | undefined;
        completedAt?: string | undefined;
    }>;
    results: z.ZodOptional<z.ZodObject<{
        successCount: z.ZodNumber;
        errorCount: z.ZodNumber;
        errors: z.ZodArray<z.ZodObject<{
            itemId: z.ZodString;
            error: z.ZodString;
            timestamp: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            timestamp: string;
            error: string;
            itemId: string;
        }, {
            timestamp: string;
            error: string;
            itemId: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        errors: {
            timestamp: string;
            error: string;
            itemId: string;
        }[];
        successCount: number;
        errorCount: number;
    }, {
        errors: {
            timestamp: string;
            error: string;
            itemId: string;
        }[];
        successCount: number;
        errorCount: number;
    }>>;
}, "strip", z.ZodTypeAny, {
    status: "completed" | "failed" | "processing" | "pending" | "cancelled";
    metadata: {
        createdAt: string;
        submittedBy: string;
        jobType: "embedding" | "indexing" | "reprocessing";
        processingTime?: number | undefined;
        startedAt?: string | undefined;
        completedAt?: string | undefined;
    };
    progress: {
        totalItems: number;
        processedItems: number;
        failedItems: number;
        percentage: number;
    };
    collectionId: string;
    jobId: string;
    results?: {
        errors: {
            timestamp: string;
            error: string;
            itemId: string;
        }[];
        successCount: number;
        errorCount: number;
    } | undefined;
}, {
    status: "completed" | "failed" | "processing" | "pending" | "cancelled";
    metadata: {
        createdAt: string;
        submittedBy: string;
        jobType: "embedding" | "indexing" | "reprocessing";
        processingTime?: number | undefined;
        startedAt?: string | undefined;
        completedAt?: string | undefined;
    };
    progress: {
        totalItems: number;
        processedItems: number;
        failedItems: number;
        percentage: number;
    };
    collectionId: string;
    jobId: string;
    results?: {
        errors: {
            timestamp: string;
            error: string;
            itemId: string;
        }[];
        successCount: number;
        errorCount: number;
    } | undefined;
}>;
export declare const EmbeddingAnalyticsSchema: z.ZodObject<{
    collectionId: z.ZodString;
    timeRange: z.ZodObject<{
        start: z.ZodString;
        end: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        end: string;
        start: string;
    }, {
        end: string;
        start: string;
    }>;
    metrics: z.ZodObject<{
        totalEmbeddings: z.ZodNumber;
        averageEmbeddingTime: z.ZodNumber;
        totalProcessingTime: z.ZodNumber;
        embeddingSuccessRate: z.ZodNumber;
        averageTextLength: z.ZodNumber;
        topDocumentTypes: z.ZodArray<z.ZodObject<{
            type: z.ZodString;
            count: z.ZodNumber;
            percentage: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            type: string;
            percentage: number;
            count: number;
        }, {
            type: string;
            percentage: number;
            count: number;
        }>, "many">;
        embeddingQuality: z.ZodObject<{
            averageSimilarity: z.ZodNumber;
            varianceScore: z.ZodNumber;
            clusteringCoherence: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            averageSimilarity: number;
            varianceScore: number;
            clusteringCoherence: number;
        }, {
            averageSimilarity: number;
            varianceScore: number;
            clusteringCoherence: number;
        }>;
    }, "strip", z.ZodTypeAny, {
        totalEmbeddings: number;
        averageEmbeddingTime: number;
        totalProcessingTime: number;
        embeddingSuccessRate: number;
        averageTextLength: number;
        topDocumentTypes: {
            type: string;
            percentage: number;
            count: number;
        }[];
        embeddingQuality: {
            averageSimilarity: number;
            varianceScore: number;
            clusteringCoherence: number;
        };
    }, {
        totalEmbeddings: number;
        averageEmbeddingTime: number;
        totalProcessingTime: number;
        embeddingSuccessRate: number;
        averageTextLength: number;
        topDocumentTypes: {
            type: string;
            percentage: number;
            count: number;
        }[];
        embeddingQuality: {
            averageSimilarity: number;
            varianceScore: number;
            clusteringCoherence: number;
        };
    }>;
    performance: z.ZodObject<{
        searchLatency: z.ZodNumber;
        embeddingLatency: z.ZodNumber;
        storageEfficiency: z.ZodNumber;
        cacheHitRate: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        searchLatency: number;
        embeddingLatency: number;
        storageEfficiency: number;
        cacheHitRate: number;
    }, {
        searchLatency: number;
        embeddingLatency: number;
        storageEfficiency: number;
        cacheHitRate: number;
    }>;
}, "strip", z.ZodTypeAny, {
    collectionId: string;
    timeRange: {
        end: string;
        start: string;
    };
    metrics: {
        totalEmbeddings: number;
        averageEmbeddingTime: number;
        totalProcessingTime: number;
        embeddingSuccessRate: number;
        averageTextLength: number;
        topDocumentTypes: {
            type: string;
            percentage: number;
            count: number;
        }[];
        embeddingQuality: {
            averageSimilarity: number;
            varianceScore: number;
            clusteringCoherence: number;
        };
    };
    performance: {
        searchLatency: number;
        embeddingLatency: number;
        storageEfficiency: number;
        cacheHitRate: number;
    };
}, {
    collectionId: string;
    timeRange: {
        end: string;
        start: string;
    };
    metrics: {
        totalEmbeddings: number;
        averageEmbeddingTime: number;
        totalProcessingTime: number;
        embeddingSuccessRate: number;
        averageTextLength: number;
        topDocumentTypes: {
            type: string;
            percentage: number;
            count: number;
        }[];
        embeddingQuality: {
            averageSimilarity: number;
            varianceScore: number;
            clusteringCoherence: number;
        };
    };
    performance: {
        searchLatency: number;
        embeddingLatency: number;
        storageEfficiency: number;
        cacheHitRate: number;
    };
}>;
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
