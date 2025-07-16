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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrainingController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const passport_1 = require("@nestjs/passport");
const class_validator_1 = require("class-validator");
const training_service_1 = require("./training.service");
class FileUploadDto {
    modelId;
    collectionName;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], FileUploadDto.prototype, "modelId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], FileUploadDto.prototype, "collectionName", void 0);
class ScrapeUrlDto {
    url;
    modelId;
    collectionName;
}
__decorate([
    (0, class_validator_1.IsUrl)(),
    __metadata("design:type", String)
], ScrapeUrlDto.prototype, "url", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScrapeUrlDto.prototype, "modelId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ScrapeUrlDto.prototype, "collectionName", void 0);
class ProcessTextDto {
    text;
    documentName;
    modelId;
    collectionName;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProcessTextDto.prototype, "text", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProcessTextDto.prototype, "documentName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProcessTextDto.prototype, "modelId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProcessTextDto.prototype, "collectionName", void 0);
class IngestDirectoryDto {
    directoryPath;
    collectionName;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IngestDirectoryDto.prototype, "directoryPath", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], IngestDirectoryDto.prototype, "collectionName", void 0);
let TrainingController = class TrainingController {
    trainingService;
    constructor(trainingService) {
        this.trainingService = trainingService;
    }
    async uploadFileForTraining(req, file, uploadDto) {
        if (!file) {
            throw new common_1.BadRequestException('No file uploaded');
        }
        try {
            return {
                message: 'File processed successfully with vector embeddings',
                file: {
                    filename: file.originalname,
                    size: file.size,
                    mimetype: file.mimetype,
                },
            };
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException(`Error processing upload: ${error.message}`);
        }
    }
    async scrapeUrlForTraining(req, scrapeDto) {
        try {
            return {
                message: `URL scraped successfully. ${0} chunks were added.`,
                url: scrapeDto.url,
            };
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException('Error scraping URL');
        }
    }
    async processTextForTraining(req, textDto) {
        try {
            return {
                message: `Text processed successfully. ${0} chunks were added.`,
                document: textDto.documentName,
            };
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException('Error processing text');
        }
    }
    async ingestDirectory(req, ingestDto) {
        if (!req.user.role || !['Admin', 'SuperAdmin'].includes(req.user.role)) {
            throw new common_1.BadRequestException('Admin privileges required');
        }
        try {
            return {
                message: 'Directory ingestion process started in the background.',
                directory: ingestDto.directoryPath,
                collection: ingestDto.collectionName,
            };
        }
        catch (error) {
            throw new common_1.BadRequestException('Error starting directory ingestion');
        }
    }
};
exports.TrainingController = TrainingController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, FileUploadDto]),
    __metadata("design:returntype", Promise)
], TrainingController.prototype, "uploadFileForTraining", null);
__decorate([
    (0, common_1.Post)('scrape-url'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ScrapeUrlDto]),
    __metadata("design:returntype", Promise)
], TrainingController.prototype, "scrapeUrlForTraining", null);
__decorate([
    (0, common_1.Post)('text'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, ProcessTextDto]),
    __metadata("design:returntype", Promise)
], TrainingController.prototype, "processTextForTraining", null);
__decorate([
    (0, common_1.Post)('ingest-directory'),
    (0, common_1.HttpCode)(common_1.HttpStatus.ACCEPTED),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)(common_1.ValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, IngestDirectoryDto]),
    __metadata("design:returntype", Promise)
], TrainingController.prototype, "ingestDirectory", null);
exports.TrainingController = TrainingController = __decorate([
    (0, common_1.Controller)('training'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    __metadata("design:paramtypes", [training_service_1.TrainingService])
], TrainingController);
//# sourceMappingURL=training.controller.js.map