import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicEndpoint: string;

  constructor() {
    const endpoint = process.env.S3_ENDPOINT;
    this.bucket = process.env.S3_BUCKET || 'uploads';
    this.publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || endpoint || '';

    this.s3 = new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin123',
      },
      forcePathStyle: true,
    });
  }

  async upload(key: string, body: Buffer | Uint8Array | Blob | string) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
      }),
    );
    return { key, url: this.getPublicUrl(key) };
  }

  async get(key: string) {
    return this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async delete(key: string) {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  getPublicUrl(key: string) {
    return `${this.publicEndpoint}/${this.bucket}/${key}`;
  }
} 