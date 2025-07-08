import { TrainingService } from './training.service';
export declare class TrainingController {
    private readonly trainingService;
    constructor(trainingService: TrainingService);
    upload(file: Express.Multer.File): Promise<{
        message: string;
        chunks: number;
    }>;
    text(text: string): Promise<{
        message: string;
        chunks: number;
    }>;
    scrape(url: string): Promise<{
        message: string;
        chunks: number;
    }>;
}
