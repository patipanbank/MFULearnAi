"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingsModule = void 0;
const common_1 = require("@nestjs/common");
const bedrock_module_1 = require("../../infrastructure/bedrock/bedrock.module");
const redis_module_1 = require("../../infrastructure/redis/redis.module");
const embeddings_controller_1 = require("./embeddings.controller");
const embedding_service_1 = require("../../services/embedding.service");
const vector_search_service_1 = require("../../services/vector-search.service");
const cache_service_1 = require("../../services/cache.service");
const chroma_service_1 = require("../../services/chroma.service");
const document_service_1 = require("../../services/document.service");
const document_management_service_1 = require("../../services/document-management.service");
const memory_service_1 = require("../../services/memory.service");
let EmbeddingsModule = class EmbeddingsModule {
};
exports.EmbeddingsModule = EmbeddingsModule;
exports.EmbeddingsModule = EmbeddingsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bedrock_module_1.BedrockModule,
            redis_module_1.RedisModule,
        ],
        controllers: [
            embeddings_controller_1.EmbeddingsController,
        ],
        providers: [
            chroma_service_1.ChromaService,
            document_service_1.DocumentService,
            document_management_service_1.DocumentManagementService,
            memory_service_1.MemoryService,
            embedding_service_1.EmbeddingService,
            vector_search_service_1.VectorSearchService,
            cache_service_1.CacheService,
        ],
        exports: [
            embedding_service_1.EmbeddingService,
            vector_search_service_1.VectorSearchService,
            cache_service_1.CacheService,
            chroma_service_1.ChromaService,
            document_management_service_1.DocumentManagementService,
            memory_service_1.MemoryService,
        ],
    })
], EmbeddingsModule);
//# sourceMappingURL=embeddings.module.js.map