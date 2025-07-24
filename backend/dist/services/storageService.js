"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storageService = exports.StorageService = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const uuid_1 = require("uuid");
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://minio:9000';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || 'minioadmin';
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || 'minioadmin123';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET || 'uploads';
const PUBLIC_ENDPOINT = process.env.S3_PUBLIC_ENDPOINT || S3_ENDPOINT;
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
    async uploadFile(data, filename, contentType) {
        const key = `${(0, uuid_1.v4)()}/${filename}`;
        const command = new client_s3_1.PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: key,
            Body: data,
            ContentType: contentType,
        });
        await s3.send(command);
        return `${PUBLIC_ENDPOINT.replace(/\/$/, '')}/${S3_BUCKET}/${key}`;
    }
}
exports.StorageService = StorageService;
exports.storageService = new StorageService();
//# sourceMappingURL=storageService.js.map