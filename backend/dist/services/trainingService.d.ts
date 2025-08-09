import { IUser } from '../models/user';
export declare class TrainingService {
    private textSplitter;
    constructor();
    private embedAndStore;
    private splitText;
    private fallbackSplitText;
    processAndEmbedFile(fileBuffer: Buffer, fileName: string, user: IUser, modelId: string, collectionName: string): Promise<number>;
    processAndEmbedText(text: string, documentName: string, user: IUser, modelId: string, collectionName: string): Promise<number>;
}
export declare const trainingService: TrainingService;
//# sourceMappingURL=trainingService.d.ts.map