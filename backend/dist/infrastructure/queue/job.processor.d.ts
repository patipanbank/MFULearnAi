import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BedrockService } from '../bedrock/bedrock.service';
import { ChromaService } from '../../services/chroma.service';
import { DocumentManagementService } from '../../services/document-management.service';
export declare class JobProcessor extends WorkerHost {
    private readonly bedrockService;
    private readonly chromaService;
    private readonly documentManagementService;
    private readonly logger;
    constructor(bedrockService: BedrockService, chromaService: ChromaService, documentManagementService: DocumentManagementService);
    onActive(job: Job): void;
    onCompleted(job: Job): void;
    onFailed(job: Job, error: Error): void;
    onStalled(job: Job): void;
    process(job: Job): Promise<void>;
    private processDocumentProcessing;
    private processEmbedding;
    private processUsageStats;
    private processTraining;
    private processCleanup;
    private processNotification;
    private cleanupOldChats;
    private cleanupUnusedEmbeddings;
    private cleanupTempFiles;
    private getMimeType;
}
