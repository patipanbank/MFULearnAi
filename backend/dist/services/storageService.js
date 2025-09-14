"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = exports.StorageService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const uuid_1 = require("uuid");
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://mfulearnai_minio:9000';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minioadmin123';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET || 'uploads';
const getPublicEndpoint = () => {
    if (process.env.S3_PUBLIC_ENDPOINT) {
        return process.env.S3_PUBLIC_ENDPOINT;
    }
    if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production') {
        return 'https://mfulearnai.mfu.ac.th/minio';
    }
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
const s3 = new client_s3_1.S3Client({
    region: S3_REGION,
    endpoint: S3_ENDPOINT,
    credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
    },
    forcePathStyle: true,
});
class StorageService {
    async healthCheck() {
        try {
            console.log('🏥 Performing MinIO health check...');
            console.log('🔗 Connecting to:', S3_ENDPOINT);
            const { ListBucketsCommand } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-s3')));
            const command = new ListBucketsCommand({});
            const result = await s3.send(command);
            console.log('✅ MinIO health check passed, found buckets:', result.Buckets?.map(b => b.Name) || 'none');
            return true;
        }
        catch (error) {
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
    async ensureBucketExists() {
        try {
            const { HeadBucketCommand, CreateBucketCommand } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-s3')));
            const headCommand = new HeadBucketCommand({ Bucket: S3_BUCKET });
            await s3.send(headCommand);
            console.log(`✅ Bucket ${S3_BUCKET} exists`);
            await this.setBucketPublicReadPolicy();
        }
        catch (error) {
            if (error.name === 'NoSuchBucket' || error.name === 'NotFound') {
                console.log(`📦 Creating bucket ${S3_BUCKET}...`);
                try {
                    const { CreateBucketCommand } = await Promise.resolve().then(() => __importStar(require('@aws-sdk/client-s3')));
                    const createCommand = new CreateBucketCommand({ Bucket: S3_BUCKET });
                    await s3.send(createCommand);
                    console.log(`✅ Bucket ${S3_BUCKET} created successfully`);
                    await this.setBucketPublicReadPolicy();
                }
                catch (createError) {
                    console.error(`❌ Failed to create bucket ${S3_BUCKET}:`, createError.message);
                    throw createError;
                }
            }
            else {
                console.error(`❌ Error checking bucket ${S3_BUCKET}:`, error.message);
                throw error;
            }
        }
    }
    async setBucketPublicReadPolicy() {
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
            const policyCommand = new client_s3_1.PutBucketPolicyCommand({
                Bucket: S3_BUCKET,
                Policy: JSON.stringify(bucketPolicy)
            });
            await s3.send(policyCommand);
            console.log(`✅ Public read policy set for bucket ${S3_BUCKET}`);
        }
        catch (error) {
            console.warn(`⚠️ Could not set bucket policy for ${S3_BUCKET}:`, error.message);
            console.warn('This might be expected if MinIO doesn\'t support bucket policies or access is restricted');
        }
    }
    async uploadFile(data, filename, contentType) {
        try {
            console.log('🗄️ StorageService.uploadFile called:', {
                filename,
                contentType,
                dataSize: data?.length,
                bucket: S3_BUCKET,
                endpoint: S3_ENDPOINT
            });
            await this.ensureBucketExists();
            const key = `${(0, uuid_1.v4)()}/${filename}`;
            console.log('🔑 Generated key:', key);
            const command = new client_s3_1.PutObjectCommand({
                Bucket: S3_BUCKET,
                Key: key,
                Body: data,
                ContentType: contentType,
                ACL: 'public-read'
            });
            console.log('📤 Sending command to S3...');
            await s3.send(command);
            const keyParts = key.split('/');
            const encodedKeyParts = keyParts.map(part => encodeURIComponent(part));
            const encodedKey = encodedKeyParts.join('/');
            const url = `${PUBLIC_ENDPOINT.replace(/\/$/, '')}/${S3_BUCKET}/${encodedKey}`;
            console.log('✅ Upload successful, generated URL:', url);
            console.log('📋 Key stored in MinIO:', key);
            console.log('📋 Encoded key for URL:', encodedKey);
            return url;
        }
        catch (error) {
            console.error('❌ StorageService upload error:', {
                message: error.message,
                code: error.code,
                name: error.name,
                stack: error.stack
            });
            throw error;
        }
    }
    async getFileAsBase64(url) {
        try {
            console.log('🔍 getFileAsBase64 called with URL:', url);
            console.log('🔍 Expected bucket name:', S3_BUCKET);
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
            key = decodeURIComponent(key);
            console.log('🔑 Decoded key:', key);
            const command = new client_s3_1.GetObjectCommand({
                Bucket: S3_BUCKET,
                Key: key,
            });
            console.log('📤 Sending GetObjectCommand to MinIO...');
            const response = await s3.send(command);
            if (!response.Body) {
                console.error('No body in S3 response');
                return null;
            }
            const chunks = [];
            for await (const chunk of response.Body) {
                chunks.push(chunk);
            }
            const buffer = Buffer.concat(chunks);
            const base64Data = buffer.toString('base64');
            const mediaType = response.ContentType || 'image/jpeg';
            return {
                data: base64Data,
                mediaType
            };
        }
        catch (error) {
            console.error('Error getting file from MinIO:', error);
            return null;
        }
    }
    async generatePresignedUrl(key, expiresIn = 3600) {
        return `${PUBLIC_ENDPOINT.replace(/\/$/, '')}/${S3_BUCKET}/${key}`;
    }
}
exports.StorageService = StorageService;
exports.storageService = new StorageService();
//# sourceMappingURL=storageService.js.map