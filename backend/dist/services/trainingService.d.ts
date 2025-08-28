import { IUser } from '../models/user';
export declare class TrainingService {
    private textSplitter;
    constructor();
    private embedAndStore;
    private splitText;
    private fallbackSplitText;
    parseFileContent(fileBuffer: Buffer, fileName: string): Promise<string>;
    splitTextWithProgress(text: string, onProgress?: (progress: number) => void): Promise<string[]>;
    createEmbeddingsWithProgress(chunks: string[], modelId: string, onProgress?: (progress: number) => void): Promise<number[][]>;
    storeDocumentsWithProgress(chunks: string[], embeddings: number[][], sourceName: string, user: IUser, modelId: string, collectionName: string, onProgress?: (progress: number) => void): Promise<number>;
    processAndEmbedFile(fileBuffer: Buffer, fileName: string, user: IUser, modelId: string, collectionName: string): Promise<number>;
    processAndEmbedText(text: string, documentName: string, user: IUser, modelId: string, collectionName: string): Promise<number>;
    processAndEmbedUrl(url: string, user: IUser, modelId: string, collectionName: string): Promise<number>;
}
export declare const trainingService: TrainingService;
//# sourceMappingURL=trainingService.d.ts.map