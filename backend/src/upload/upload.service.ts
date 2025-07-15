import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import * as AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private s3Client: AWS.S3;

  constructor(private configService: ConfigService) {
    // Configure MinIO client (S3-compatible)
    const s3Config = {
      endpoint: this.configService.s3Endpoint,
      accessKeyId: this.configService.s3AccessKey,
      secretAccessKey: this.configService.s3SecretKey,
      region: this.configService.s3Region,
      s3ForcePathStyle: true, // Required for MinIO
      signatureVersion: 'v4',
    };

    this.s3Client = new AWS.S3(s3Config);
  }

  async uploadFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<{ url: string; mediaType: string }> {
    try {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('File too large (max 10 MB)');
      }

      const bucket = this.configService.s3Bucket;
      const publicEndpoint = this.configService.s3PublicEndpoint;
      
      // Generate unique key for the file
      const key = `${uuidv4().replace(/-/g, '')}/${file.originalname}`;

      // Upload to MinIO
      const uploadParams: AWS.S3.PutObjectRequest = {
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype || 'application/octet-stream',
        Metadata: {
          uploadedBy: userId,
          originalName: file.originalname,
        },
      };

      await this.s3Client.putObject(uploadParams).promise();

      // Return public URL
      const url = `${publicEndpoint}/${bucket}/${key}`;

      this.logger.log(`File uploaded successfully: ${url}`);

      return {
        url,
        mediaType: file.mimetype || 'application/octet-stream',
      };
    } catch (error) {
      this.logger.error(`Upload failed: ${error.message}`, error.stack);
      throw new Error(`Upload failed: ${error.message}`);
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const bucket = this.configService.s3Bucket;
      
      // Extract key from URL
      const urlParts = fileUrl.split('/');
      const key = urlParts.slice(-2).join('/'); // Get the last two parts (uuid/filename)

      const deleteParams: AWS.S3.DeleteObjectRequest = {
        Bucket: bucket,
        Key: key,
      };

      await this.s3Client.deleteObject(deleteParams).promise();
      this.logger.log(`File deleted successfully: ${fileUrl}`);
    } catch (error) {
      this.logger.error(`Delete failed: ${error.message}`, error.stack);
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  async getFileInfo(fileUrl: string): Promise<AWS.S3.HeadObjectOutput> {
    try {
      const bucket = this.configService.s3Bucket;
      
      // Extract key from URL
      const urlParts = fileUrl.split('/');
      const key = urlParts.slice(-2).join('/');

      const headParams: AWS.S3.HeadObjectRequest = {
        Bucket: bucket,
        Key: key,
      };

      return await this.s3Client.headObject(headParams).promise();
    } catch (error) {
      this.logger.error(`Get file info failed: ${error.message}`, error.stack);
      throw new Error(`Get file info failed: ${error.message}`);
    }
  }
} 