import { Queue } from 'bullmq';
import { DocumentService } from '../../services/document.service';
import { BedrockService } from '../../infrastructure/bedrock/bedrock.service';
export declare class TrainingService {
    private readonly queue;
    private readonly documentService;
    private readonly bedrockService;
    private readonly chunkSize;
    private readonly chunkOverlap;
    constructor(queue: Queue, documentService: DocumentService, bedrockService: BedrockService);
    private splitText;
    processBuffer(buffer: Buffer, filename: string, chatId?: string): Promise<number>;
    processRawText(text: string, chatId?: string): Promise<number>;
    processUrlContent(text: string, url: string): Promise<number>;
}
