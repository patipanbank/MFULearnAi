import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  PORT: number;
  LOG_LEVEL: string;
  NODE_ENV: string;
  S3_ENDPOINT: string;
  S3_ACCESS_KEY: string;
  S3_SECRET_KEY: string;
  S3_REGION: string;
  S3_BUCKET: string;
  S3_PUBLIC_ENDPOINT: string;
}

const config: Config = {
  PORT: parseInt(process.env.PORT || '3006'),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  NODE_ENV: process.env.NODE_ENV || 'development',
  S3_ENDPOINT: process.env.S3_ENDPOINT || 'http://minio:9000',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || 'minioadmin',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || 'minioadmin123',
  S3_REGION: process.env.S3_REGION || 'us-east-1',
  S3_BUCKET: process.env.S3_BUCKET || 'uploads',
  S3_PUBLIC_ENDPOINT: process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT || 'http://minio:9000',
};

export default config;
