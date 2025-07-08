import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BedrockService } from '../bedrock/bedrock.service';
import { ChromaService } from '../../services/chroma.service';
export declare class EmbeddingProcessor extends WorkerHost {
    private readonly bedrockService;
    private readonly chromaService;
    constructor(bedrockService: BedrockService, chromaService: ChromaService);
    process(job: Job<{
        text: string;
        chatId: string;
        messageId: string;
    }>): Promise<void>;
}
