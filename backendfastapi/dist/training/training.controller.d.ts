import { TrainingService } from './training.service';
declare class FileUploadDto {
    modelId: string;
    collectionName: string;
}
declare class ScrapeUrlDto {
    url: string;
    modelId: string;
    collectionName: string;
}
declare class ProcessTextDto {
    text: string;
    documentName: string;
    modelId: string;
    collectionName: string;
}
declare class IngestDirectoryDto {
    directoryPath: string;
    collectionName: string;
}
export declare class TrainingController {
    private readonly trainingService;
    constructor(trainingService: TrainingService);
    uploadFileForTraining(req: any, file: any, uploadDto: FileUploadDto): Promise<{
        message: string;
        file: {
            filename: any;
            size: any;
            mimetype: any;
        };
    }>;
    scrapeUrlForTraining(req: any, scrapeDto: ScrapeUrlDto): Promise<{
        message: string;
        url: string;
    }>;
    processTextForTraining(req: any, textDto: ProcessTextDto): Promise<{
        message: string;
        document: string;
    }>;
    ingestDirectory(req: any, ingestDto: IngestDirectoryDto): Promise<{
        message: string;
        directory: string;
        collection: string;
    }>;
}
export {};
