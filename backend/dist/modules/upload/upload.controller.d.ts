import { StorageService } from '../../infrastructure/storage/storage.service';
export declare class UploadController {
    private readonly storageService;
    constructor(storageService: StorageService);
    upload(file: Express.Multer.File): Promise<{
        url: string;
        mediaType: string;
    }>;
}
