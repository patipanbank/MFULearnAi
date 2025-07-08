import { BedrockService } from '../infrastructure/bedrock/bedrock.service';
import { ChromaService } from './chroma.service';
import { DocumentService } from './document.service';
export interface DocumentChunk {
    id: string;
    collectionId: string;
    documentId: string;
    text: string;
    embedding?: number[];
    metadata: {
        filename: string;
        page?: number;
        chunkIndex: number;
        totalChunks: number;
        characters: number;
        uploadedBy: string;
        uploadedAt: Date;
        fileType: string;
        fileSize: number;
    };
}
export interface DocumentUploadResult {
    documentId: string;
    filename: string;
    totalChunks: number;
    totalCharacters: number;
    status: 'processing' | 'completed' | 'failed';
    message?: string;
}
export interface DocumentSearchResult {
    chunks: DocumentChunk[];
    totalResults: number;
    searchTime: number;
}
export declare class DocumentManagementService {
    private readonly bedrockService;
    private readonly chromaService;
    private readonly documentService;
    private readonly logger;
    private readonly maxChunkSize;
    private readonly chunkOverlap;
    private readonly supportedFormats;
    constructor(bedrockService: BedrockService, chromaService: ChromaService, documentService: DocumentService);
    uploadDocument(collectionId: string, file: Express.Multer.File, userId: string): Promise<DocumentUploadResult>;
    searchDocuments(collectionId: string, query: string, limit?: number, minSimilarity?: number): Promise<DocumentSearchResult>;
    getDocuments(collectionId: string, limit?: number): Promise<DocumentChunk[]>;
    deleteDocument(collectionId: string, documentId: string): Promise<void>;
    getCollectionStats(collectionId: string): Promise<{
        totalDocuments: number;
        totalChunks: number;
        averageChunkSize: number;
        uniqueFileTypes: string[];
    }>;
    private validateFile;
    private extractTextContent;
    private splitIntoChunks;
    private createChunk;
    private createEmbeddingsForChunks;
    private storeChunksInVectorDB;
    private convertSearchResultsToChunks;
    private getCollectionName;
    private getFileType;
}
