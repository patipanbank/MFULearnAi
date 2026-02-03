import { Client } from 'minio';
import dotenv from 'dotenv';

dotenv.config();

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = parseInt(process.env.MINIO_PORT || '9000');
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
        console.log(`[MinIO] Connecting to ${MINIO_ENDPOINT}:${MINIO_PORT}...`);
        const exists = await minioClient.bucketExists(MINIO_BUCKET);
        if (exists) {
            console.log(`[MinIO] Bucket '${MINIO_BUCKET}' exists.`);
        } else {
            await minioClient.makeBucket(MINIO_BUCKET, 'us-east-1');
            console.log(`[MinIO] Bucket '${MINIO_BUCKET}' created.`);

            // Set policy to download if needed (public) or keep private
            // For now, keep private or use presigned URLs. 
            // If we need public download:
            // const policy = { ... };
            // await minioClient.setBucketPolicy(MINIO_BUCKET, JSON.stringify(policy));
        }
    } catch (err) {
        console.error('[MinIO] Initialization failed:', err);
    }
};
