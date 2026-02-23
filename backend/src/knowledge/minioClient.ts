import { Client } from 'minio';
import dotenv from 'dotenv';
import { LoggerService } from '../services/LoggerService';

dotenv.config();

export const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
export const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin';
export const MINIO_BUCKET = process.env.MINIO_BUCKET || 'mfulearnai-knowledge';

export const minioClient = new Client({
    endPoint: MINIO_ENDPOINT,
    port: MINIO_PORT,
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: MINIO_ACCESS_KEY,
    secretKey: MINIO_SECRET_KEY
});

export const initMinio = async () => {
    try {
        LoggerService.info('minio_connecting', { endpoint: MINIO_ENDPOINT, port: MINIO_PORT });
        const exists = await minioClient.bucketExists(MINIO_BUCKET);
        if (exists) {
            LoggerService.info('minio_bucket_exists', { bucket: MINIO_BUCKET });
        } else {
            await minioClient.makeBucket(MINIO_BUCKET, 'us-east-1');
            LoggerService.info('minio_bucket_created', { bucket: MINIO_BUCKET });
        }

        const CHAT_BUCKET = 'chat-attachments';
        const chatExists = await minioClient.bucketExists(CHAT_BUCKET);
        if (!chatExists) {
            await minioClient.makeBucket(CHAT_BUCKET, 'us-east-1');
            LoggerService.info('minio_bucket_created', { bucket: CHAT_BUCKET });
        }
    } catch (err: any) {
        LoggerService.error('minio_init_failed', { error: err.message });
    }
};
