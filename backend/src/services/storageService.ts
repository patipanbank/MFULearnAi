import { S3Client, PutObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import config from '../config/config';

const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://mfulearnai_minio:9000';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minioadmin123';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET || 'uploads';
// Determine public endpoint based on environment
const getPublicEndpoint = () => {
  if (process.env.S3_PUBLIC_ENDPOINT) {
    return process.env.S3_PUBLIC_ENDPOINT;
  }

  // Production: use HTTPS endpoint accessible from browser
  if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
    return 'https://mfulearnai.mfu.ac.th/minio';
  }

  // Development: check if using Docker internal network
  if (S3_ENDPOINT.includes('mfulearnai_minio') || S3_ENDPOINT.includes('minio:')) {
    return 'http://localhost:9000';
  }

  return S3_ENDPOINT;
};

const PUBLIC_ENDPOINT = getPublicEndpoint();

console.log('🔧 StorageService configuration:', {
  NODE_ENV: process.env.NODE_ENV,
  APP_ENV: process.env.APP_ENV,
  S3_ENDPOINT,
  S3_ACCESS_KEY: S3_ACCESS_KEY ? '***' + S3_ACCESS_KEY.slice(-4) : 'undefined',
  S3_SECRET_KEY: S3_SECRET_KEY ? '***' + S3_SECRET_KEY.slice(-4) : 'undefined',
  S3_REGION,
  S3_BUCKET,
  PUBLIC_ENDPOINT,
  S3_PUBLIC_ENDPOINT_ENV: process.env.S3_PUBLIC_ENDPOINT
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

  // Auto create bucket if it doesn't exist
  async ensureBucketExists(): Promise<void> {
    try {
      const { HeadBucketCommand, CreateBucketCommand } = await import('@aws-sdk/client-s3');

      // Check if bucket exists
      const headCommand = new HeadBucketCommand({ Bucket: S3_BUCKET });
      await s3.send(headCommand);
      console.log(`✅ Bucket ${S3_BUCKET} exists`);

      // Ensure bucket has public read policy
      await this.setBucketPublicReadPolicy();

    } catch (error: any) {
      if (error.name === 'NoSuchBucket' || error.name === 'NotFound') {
        console.log(`📦 Creating bucket ${S3_BUCKET}...`);
        try {
          const { CreateBucketCommand } = await import('@aws-sdk/client-s3');
          const createCommand = new CreateBucketCommand({ Bucket: S3_BUCKET });
          await s3.send(createCommand);
          console.log(`✅ Bucket ${S3_BUCKET} created successfully`);

          // Set public read policy for the new bucket
          await this.setBucketPublicReadPolicy();

        } catch (createError: any) {
          console.error(`❌ Failed to create bucket ${S3_BUCKET}:`, createError.message);
          throw createError;
        }
      } else {
        console.error(`❌ Error checking bucket ${S3_BUCKET}:`, error.message);
        throw error;
      }
    }
  }

  private async setBucketPublicReadPolicy(): Promise<void> {
    try {
      console.log(`🔐 Setting public read policy for bucket ${S3_BUCKET}...`);

      const bucketPolicy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: `arn:aws:s3:::${S3_BUCKET}/*`
          }
        ]
      };

      const policyCommand = new PutBucketPolicyCommand({
        Bucket: S3_BUCKET,
        Policy: JSON.stringify(bucketPolicy)
      });

      await s3.send(policyCommand);
      console.log(`✅ Public read policy set for bucket ${S3_BUCKET}`);

    } catch (error: any) {
      console.warn(`⚠️ Could not set bucket policy for ${S3_BUCKET}:`, error.message);
      console.warn('This might be expected if MinIO doesn\'t support bucket policies or access is restricted');
      // Don't throw here as the bucket creation was successful
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

      // Ensure bucket exists before upload
      await this.ensureBucketExists();

      const key = `${uuidv4()}/${filename}`;
      console.log('🔑 Generated key:', key);

      const command = new PutObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
        Body: data,
        ContentType: contentType,
        ACL: 'public-read' // Make object publicly readable
      });

      console.log('📤 Sending command to S3...');
      await s3.send(command);

      // Generate URL with properly encoded key for browsers
      // Only encode the filename part, keep the directory separator (/) unencoded
      const keyParts = key.split('/');
      const encodedKeyParts = keyParts.map(part => encodeURIComponent(part));
      const encodedKey = encodedKeyParts.join('/');

      const url = `${PUBLIC_ENDPOINT.replace(/\/$/, '')}/${S3_BUCKET}/${encodedKey}`;
      console.log('✅ Upload successful, generated URL:', url);
      console.log('📋 Key stored in MinIO:', key);
      console.log('📋 Encoded key for URL:', encodedKey);

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
      console.log('🔍 getFileAsBase64 called with URL:', url);
      console.log('🔍 Expected bucket name:', S3_BUCKET);

      // แยก key จาก URL
      const urlParts = url.split('/');
      console.log('🔍 URL parts:', urlParts);

      const bucketIndex = urlParts.findIndex(part => part === S3_BUCKET);
      console.log('🔍 Bucket index found:', bucketIndex);

      if (bucketIndex === -1) {
        console.error('❌ Invalid S3 URL format - bucket not found in URL');
        console.error('❌ Looking for bucket:', S3_BUCKET);
        console.error('❌ In URL parts:', urlParts);
        return null;
      }

      let key = urlParts.slice(bucketIndex + 1).join('/');
      console.log('🔑 Raw extracted key:', key);

      // Decode URL-encoded key (e.g., %20 -> space)
      key = decodeURIComponent(key);
      console.log('🔑 Decoded key:', key);

      const command = new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      });

      console.log('📤 Sending GetObjectCommand to MinIO...');
      
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