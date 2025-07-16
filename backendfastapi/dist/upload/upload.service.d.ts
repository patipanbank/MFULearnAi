import { ConfigService } from '../config/config.service';
import * as AWS from 'aws-sdk';
export declare class UploadService {
    private configService;
    private readonly logger;
    private s3Client;
    constructor(configService: ConfigService);
    uploadFile(file: Express.Multer.File, userId: string): Promise<{
        url: string;
        mediaType: string;
    }>;
    deleteFile(fileUrl: string): Promise<void>;
    getFileInfo(fileUrl: string): Promise<AWS.S3.HeadObjectOutput>;
}
