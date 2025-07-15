import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class ConfigService {
  constructor(private configService: NestConfigService) {}

  // Database Configuration
  get mongoUri(): string {
    return this.configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/nestjs-chat';
  }

  // Redis Configuration
  get redisHost(): string {
    return this.configService.get<string>('REDIS_HOST') || 'localhost';
  }

  get redisPort(): number {
    return parseInt(this.configService.get<string>('REDIS_PORT') || '6379', 10);
  }

  get redisUrl(): string {
    return this.configService.get<string>('REDIS_URL') || `redis://${this.redisHost}:${this.redisPort}`;
  }

  // JWT Configuration
  get jwtSecret(): string {
    return this.configService.get<string>('JWT_SECRET') || 'your-secret-key';
  }

  get jwtExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN') || '1h';
  }

  // Application Configuration
  get port(): number {
    return parseInt(this.configService.get<string>('PORT') || '3001', 10);
  }

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV') || 'development';
  }

  // CORS Configuration
  get corsOrigin(): string {
    return this.configService.get<string>('CORS_ORIGIN') || 'http://localhost:3000';
  }

  // AWS Configuration
  get awsAccessKeyId(): string {
    return this.configService.get<string>('AWS_ACCESS_KEY_ID') || '';
  }

  get awsSecretAccessKey(): string {
    return this.configService.get<string>('AWS_SECRET_ACCESS_KEY') || '';
  }

  get awsRegion(): string {
    return this.configService.get<string>('AWS_REGION') || 'us-east-1';
  }

  get awsS3Bucket(): string {
    return this.configService.get<string>('AWS_S3_BUCKET') || '';
  }

  // Google OAuth Configuration
  get googleClientId(): string {
    return this.configService.get<string>('GOOGLE_CLIENT_ID') || '';
  }

  get googleClientSecret(): string {
    return this.configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
  }

  // ChromaDB Configuration
  get chromaUrl(): string {
    return this.configService.get<string>('CHROMA_URL') || 'http://localhost:8000';
  }

  get chromaApiKey(): string {
    return this.configService.get<string>('CHROMA_API_KEY') || '';
  }

  // SAML Configuration - เพิ่มใหม่
  get samlSpEntityId(): string {
    return this.configService.get<string>('SAML_SP_ENTITY_ID') || '';
  }

  get samlSpAcsUrl(): string {
    return this.configService.get<string>('SAML_SP_ACS_URL') || '';
  }

  get samlIdpSsoUrl(): string {
    return this.configService.get<string>('SAML_IDP_SSO_URL') || '';
  }

  get samlIdpSloUrl(): string {
    return this.configService.get<string>('SAML_IDP_SLO_URL') || '';
  }

  get samlIdpEntityId(): string {
    return this.configService.get<string>('SAML_IDP_ENTITY_ID') || '';
  }

  get samlCertificate(): string {
    return this.configService.get<string>('SAML_CERTIFICATE') || '';
  }

  get samlPrivateKey(): string {
    return this.configService.get<string>('SAML_PRIVATE_KEY') || '';
  }

  get samlIdentifierFormat(): string {
    return this.configService.get<string>('SAML_IDENTIFIER_FORMAT') || '';
  }

  // Frontend URL
  get frontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  // S3/MinIO Configuration
  get s3Endpoint(): string {
    return this.configService.get<string>('S3_ENDPOINT') || 'http://minio:9000';
  }

  get s3AccessKey(): string {
    return this.configService.get<string>('S3_ACCESS_KEY') || 'minioadmin';
  }

  get s3SecretKey(): string {
    return this.configService.get<string>('S3_SECRET_KEY') || 'minioadmin123';
  }

  get s3Bucket(): string {
    return this.configService.get<string>('S3_BUCKET') || 'uploads';
  }

  get s3Region(): string {
    return this.configService.get<string>('S3_REGION') || 'us-east-1';
  }

  get s3PublicEndpoint(): string {
    return this.configService.get<string>('S3_PUBLIC_ENDPOINT') || this.s3Endpoint;
  }

  // Generic get method
  get<T = any>(key: string): T | undefined {
    return this.configService.get<T>(key);
  }
} 