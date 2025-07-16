import { Model } from 'mongoose';
import { TrainingHistory, TrainingHistoryDocument } from '../models/training-history.model';
import { ChromaService } from '../collection/chroma.service';
import { BedrockService } from '../bedrock/bedrock.service';
import { DocumentService } from '../upload/document.service';
import { WebScraperService } from '../upload/web-scraper.service';
import { ConfigService } from '../config/config.service';
export interface TrainingDocument {
    id: string;
    document: string;
    metadata: Record<string, any>;
    embedding: number[];
}
export declare class TrainingService {
    private trainingHistoryModel;
    private chromaService;
    private bedrockService;
    private documentService;
    private webScraperService;
    private configService;
    private readonly logger;
    private readonly CHUNK_SIZE;
    private readonly CHUNK_OVERLAP;
    constructor(trainingHistoryModel: Model<TrainingHistoryDocument>, chromaService: ChromaService, bedrockService: BedrockService, documentService: DocumentService, webScraperService: WebScraperService, configService: ConfigService);
    private splitTextIntoChunks;
    private embedAndStore;
    uploadDocument(userId: string, username: string, collectionName: string, documentName: string, file: Express.Multer.File, modelId: string): Promise<any>;
    scrapeUrl(userId: string, username: string, collectionName: string, url: string, modelId: string): Promise<any>;
    processText(userId: string, username: string, collectionName: string, documentName: string, text: string, modelId: string): Promise<any>;
    deleteDocument(userId: string, username: string, collectionName: string, documentName: string): Promise<any>;
    createCollection(userId: string, username: string, collectionName: string, description?: string): Promise<any>;
    updateCollection(userId: string, username: string, collectionName: string, updates: any): Promise<any>;
    deleteCollection(userId: string, username: string, collectionName: string): Promise<any>;
    getTrainingHistory(userId: string, limit?: number): Promise<TrainingHistory[]>;
    getTrainingStats(userId?: string): Promise<any>;
}
