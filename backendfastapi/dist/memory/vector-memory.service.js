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
var VectorMemoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorMemoryService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const documents_1 = require("@langchain/core/documents");
let VectorMemoryService = VectorMemoryService_1 = class VectorMemoryService {
    configService;
    logger = new common_1.Logger(VectorMemoryService_1.name);
    vectorStore = null;
    embeddings = null;
    constructor(configService) {
        this.configService = configService;
        this.initializeVectorStore();
    }
    async initializeVectorStore() {
        try {
            this.embeddings = null;
            this.logger.log('Vector memory service initialized');
        }
        catch (error) {
            this.logger.error(`Failed to initialize vector store: ${error}`);
        }
    }
    async initializeEmbeddings() {
        return {
            region: this.configService.get('AWS_REGION') || 'us-east-1',
            credentials: {
                accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID') || '',
                secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY') || '',
            },
        };
    }
    async addMemory(sessionId, content, metadata) {
        try {
            if (!this.vectorStore) {
                this.logger.warn('Vector store not initialized');
                return;
            }
            const document = new documents_1.Document({
                pageContent: content,
                metadata: {
                    sessionId,
                    timestamp: new Date().toISOString(),
                    ...metadata,
                },
            });
            this.logger.log(`Memory added for session ${sessionId}`);
        }
        catch (error) {
            this.logger.error(`Error adding memory: ${error}`);
        }
    }
    async searchMemory(sessionId, query, k = 5) {
        try {
            if (!this.vectorStore) {
                this.logger.warn('Vector store not initialized');
                return [];
            }
            return [];
        }
        catch (error) {
            this.logger.error(`Error searching memory: ${error}`);
            return [];
        }
    }
    async clearMemory(sessionId) {
        try {
            if (!this.vectorStore) {
                this.logger.warn('Vector store not initialized');
                return;
            }
            this.logger.log(`Memory cleared for session ${sessionId}`);
        }
        catch (error) {
            this.logger.error(`Error clearing memory: ${error}`);
        }
    }
};
exports.VectorMemoryService = VectorMemoryService;
exports.VectorMemoryService = VectorMemoryService = VectorMemoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], VectorMemoryService);
//# sourceMappingURL=vector-memory.service.js.map