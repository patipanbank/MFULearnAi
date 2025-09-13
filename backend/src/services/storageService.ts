import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/config';

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://mfulearnai_minio:9000';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minioadmin123';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET || 'uploads';
const PUBLIC_ENDPOINT = process.env.S3_PUBLIC_ENDPOINT || S3_ENDPOINT;

console.log('🔧 StorageService configuration:', {
  S3_ENDPOINT,
  S3_ACCESS_KEY: S3_ACCESS_KEY ? '***' + S3_ACCESS_KEY.slice(-4) : 'undefined',
  S3_SECRET_KEY: S3_SECRET_KEY ? '***' + S3_SECRET_KEY.slice(-4) : 'undefined',
  S3_REGION,
  S3_BUCKET,
  PUBLIC_ENDPOINT
});

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
  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      console.log('🏥 Performing MinIO health check...');
      console.log('🔗 Connecting to:', S3_ENDPOINT);

      // Try to list buckets as a simple health check
      const { ListBucketsCommand } = await import('@aws-sdk/client-s3');
      const command = new ListBucketsCommand({});
      const result = await s3.send(command);

      console.log('✅ MinIO health check passed, found buckets:',
        result.Buckets?.map(b => b.Name) || 'none'
      );
      return true;
    } catch (error: any) {
      console.error('❌ MinIO health check failed:', {
        message: error.message,
        code: error.code,
        name: error.name,
        endpoint: S3_ENDPOINT,
        bucket: S3_BUCKET
      });
      return false;
    }
  }

  async uploadFile(data: Buffer, filename: string, contentType: string): Promise<string> {
    try {
      console.log('🗄️ StorageService.uploadFile called:', {
        filename,
        contentType,
        dataSize: data?.length,
        bucket: S3_BUCKET,
        endpoint: S3_ENDPOINT
      });

      const key = `${uuidv4()}/${filename}`;
      console.log('🔑 Generated key:', key);

      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: data,
        ContentType: contentType,
      });

      console.log('📤 Sending command to S3...');
      await s3.send(command);

      const url = `${PUBLIC_ENDPOINT.replace(/\/$/, '')}/${S3_BUCKET}/${key}`;
      console.log('✅ Upload successful, generated URL:', url);

      return url;
    } catch (error: any) {
      console.error('❌ StorageService upload error:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      });
      throw error;
    }
  }

  // เพิ่มฟังก์ชันสำหรับดึงไฟล์จาก MinIO และแปลงเป็น base64
  async getFileAsBase64(url: string): Promise<{ data: string; mediaType: string } | null> {
    try {
      // แยก key จาก URL
      const urlParts = url.split('/');
      const bucketIndex = urlParts.findIndex(part => part === S3_BUCKET);
      if (bucketIndex === -1) {
        console.error('Invalid S3 URL format');
        return null;
      }
      
      const key = urlParts.slice(bucketIndex + 1).join('/');
      
      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      });
      
      const response = await s3.send(command);
      if (!response.Body) {
        console.error('No body in S3 response');
        return null;
      }
      
      // อ่านไฟล์เป็น Buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      // แปลงเป็น base64
      const base64Data = buffer.toString('base64');
      const mediaType = response.ContentType || 'image/jpeg';
      
      return {
        data: base64Data,
        mediaType
      };
    } catch (error) {
      console.error('Error getting file from MinIO:', error);
      return null;
    }
  }

  // ฟังก์ชันช่วยสร้าง pre-signed URL สำหรับการเข้าถึงไฟล์ (ถ้าต้องการ)
  async generatePresignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    // TODO: Implement pre-signed URL generation if needed
    // สำหรับตอนนี้ใช้ getObject ตรงๆ แทน
    return `${PUBLIC_ENDPOINT.replace(/\/$/, '')}/${S3_BUCKET}/${key}`;
  }
}

export const storageService = new StorageService(); 