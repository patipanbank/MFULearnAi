import { Injectable, BadRequestException } from '@nestjs/common';
import { User } from '../models/user.model';
import { ConfigService } from '../config/config.service';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadResult {
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  path: string;
  url: string;
}

@Injectable()
export class UploadService {
  private readonly maxFileSize = 10 * 1024 * 1024; // 10MB like FastAPI
  private s3Client: S3Client;
  
  constructor(private configService: ConfigService) {
    // Initialize S3 client
    this.s3Client = new S3Client({
      region: this.configService.awsRegion,
      credentials: {
        accessKeyId: this.configService.awsAccessKeyId,
        secretAccessKey: this.configService.awsSecretAccessKey,
      },
    });
  }

  async uploadFile(file: any, user: User): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      throw new BadRequestException(`File too large. Maximum size is ${this.maxFileSize / 1024 / 1024}MB`);
    }

    // Generate unique filename
    const filename = this.generateUniqueFilename(file.originalname);
    const key = `uploads/${(user as any)._id}/${filename}`;

    try {
      // Upload to S3
      const command = new PutObjectCommand({
        Bucket: this.configService.awsS3Bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname,
          uploadedBy: (user as any)._id,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);

      // Generate signed URL for access
      const url = `https://${this.configService.awsS3Bucket}.s3.${this.configService.awsRegion}.amazonaws.com/${key}`;

      return {
        filename,
        originalName: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        path: key,
        url,
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new BadRequestException('Failed to upload file to storage');
    }
  }

  async uploadMultipleFiles(files: any[], user: User): Promise<UploadResult[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const results: UploadResult[] = [];
    
    for (const file of files) {
      try {
        const result = await this.uploadFile(file, user);
        results.push(result);
      } catch (error) {
        console.error(`Failed to upload file ${file.originalname}:`, error);
        // Continue with other files
      }
    }

    if (results.length === 0) {
      throw new BadRequestException('All file uploads failed');
    }

    return results;
  }

  async deleteFile(filename: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.configService.awsS3Bucket,
        Key: filename,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Failed to delete file from S3:', error);
      throw new BadRequestException('Failed to delete file');
    }
  }

  private generateUniqueFilename(originalName: string): string {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
    const baseName = originalName.includes('.') ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;
    
    return `${baseName}_${timestamp}_${randomString}${extension}`;
  }

  isValidFileType(mimetype: string): boolean {
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/json',
      'application/xml',
      'text/xml',
    ];

    return allowedTypes.includes(mimetype);
  }
} 