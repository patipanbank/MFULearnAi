"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StorageService = void 0;
const common_1 = require("@nestjs/common");
const client_s3_1 = require("@aws-sdk/client-s3");
let StorageService = class StorageService {
    constructor() {
        const endpoint = process.env.S3_ENDPOINT;
        this.bucket = process.env.S3_BUCKET || 'uploads';
        this.publicEndpoint = process.env.S3_PUBLIC_ENDPOINT || endpoint || '';
        this.s3 = new client_s3_1.S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            endpoint,
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
                secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin123',
            },
            forcePathStyle: true,
        });
    }
    async upload(key, body) {
        await this.s3.send(new client_s3_1.PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: body,
        }));
        return { key, url: this.getPublicUrl(key) };
    }
    async get(key) {
        return this.s3.send(new client_s3_1.GetObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));
    }
    async delete(key) {
        await this.s3.send(new client_s3_1.DeleteObjectCommand({
            Bucket: this.bucket,
            Key: key,
        }));
    }
    getPublicUrl(key) {
        return `${this.publicEndpoint}/${this.bucket}/${key}`;
    }
};
exports.StorageService = StorageService;
exports.StorageService = StorageService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], StorageService);
//# sourceMappingURL=storage.service.js.map