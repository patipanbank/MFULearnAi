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
var UploadService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const AWS = require("aws-sdk");
const uuid_1 = require("uuid");
let UploadService = UploadService_1 = class UploadService {
    configService;
    logger = new common_1.Logger(UploadService_1.name);
    s3Client;
    constructor(configService) {
        this.configService = configService;
        const s3Config = {
            endpoint: this.configService.s3Endpoint,
            accessKeyId: this.configService.s3AccessKey,
            secretAccessKey: this.configService.s3SecretKey,
            region: this.configService.s3Region,
            s3ForcePathStyle: true,
            signatureVersion: 'v4',
        };
        this.s3Client = new AWS.S3(s3Config);
    }
    async uploadFile(file, userId) {
        try {
            if (file.size > 10 * 1024 * 1024) {
                throw new Error('File too large (max 10 MB)');
            }
            const bucket = this.configService.s3Bucket;
            const publicEndpoint = this.configService.s3PublicEndpoint;
            const key = `${(0, uuid_1.v4)().replace(/-/g, '')}/${file.originalname}`;
            const uploadParams = {
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
            const url = `${publicEndpoint}/${bucket}/${key}`;
            this.logger.log(`File uploaded successfully: ${url}`);
            return {
                url,
                mediaType: file.mimetype || 'application/octet-stream',
            };
        }
        catch (error) {
            this.logger.error(`Upload failed: ${error.message}`, error.stack);
            throw new Error(`Upload failed: ${error.message}`);
        }
    }
    async deleteFile(fileUrl) {
        try {
            const bucket = this.configService.s3Bucket;
            const urlParts = fileUrl.split('/');
            const key = urlParts.slice(-2).join('/');
            const deleteParams = {
                Bucket: bucket,
                Key: key,
            };
            await this.s3Client.deleteObject(deleteParams).promise();
            this.logger.log(`File deleted successfully: ${fileUrl}`);
        }
        catch (error) {
            this.logger.error(`Delete failed: ${error.message}`, error.stack);
            throw new Error(`Delete failed: ${error.message}`);
        }
    }
    async getFileInfo(fileUrl) {
        try {
            const bucket = this.configService.s3Bucket;
            const urlParts = fileUrl.split('/');
            const key = urlParts.slice(-2).join('/');
            const headParams = {
                Bucket: bucket,
                Key: key,
            };
            return await this.s3Client.headObject(headParams).promise();
        }
        catch (error) {
            this.logger.error(`Get file info failed: ${error.message}`, error.stack);
            throw new Error(`Get file info failed: ${error.message}`);
        }
    }
};
exports.UploadService = UploadService;
exports.UploadService = UploadService = UploadService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], UploadService);
//# sourceMappingURL=upload.service.js.map