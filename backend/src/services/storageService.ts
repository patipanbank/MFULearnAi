import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/config';

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://minio:9000';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minioadmin123';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET || 'uploads';
const PUBLIC_ENDPOINT = process.env.S3_PUBLIC_ENDPOINT || S3_ENDPOINT;

const s3 = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

export class StorageService {
  async uploadFile(data: Buffer, filename: string, contentType: string): Promise<string> {
    const key = `${uuidv4()}/${filename}`;
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: data,
      ContentType: contentType,
    });
    await s3.send(command);
    return `${PUBLIC_ENDPOINT.replace(/\/$/, '')}/${S3_BUCKET}/${key}`;
  }
}

export const storageService = new StorageService(); 