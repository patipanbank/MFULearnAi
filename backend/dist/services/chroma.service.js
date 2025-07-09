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
var ChromaService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChromaService = void 0;
const common_1 = require("@nestjs/common");
const chromadb_1 = require("chromadb");
let ChromaService = ChromaService_1 = class ChromaService {
    constructor() {
        this.logger = new common_1.Logger(ChromaService_1.name);
        const url = process.env.CHROMA_URL || 'http://localhost:8000';
        this.logger.debug(`Connecting to ChromaDB at ${url}`);
        const parsedUrl = new URL(url);
        this.client = new chromadb_1.ChromaClient({
            host: parsedUrl.hostname,
            port: parseInt(parsedUrl.port) || (parsedUrl.protocol === 'https:' ? 443 : 80)
        });
    }
    async getCollection(name) {
        return this.client.getOrCreateCollection({ name });
    }
    async addDocuments(collectionName, docs) {
        if (!docs.length)
            return;
        const col = await this.getCollection(collectionName);
        await col.add({
            ids: docs.map((d) => d.id),
            documents: docs.map((d) => d.text),
            embeddings: docs.map((d) => d.embedding),
            metadatas: docs.map((d) => { var _a; return (_a = d.metadata) !== null && _a !== void 0 ? _a : {}; }),
        });
    }
    async queryCollection(collectionName, embedding, topK = 5) {
        const col = await this.getCollection(collectionName);
        return col.query({ queryEmbeddings: [embedding], nResults: topK, include: ['documents', 'metadatas'] });
    }
    async getDocuments(collectionName, limit = 100, offset = 0) {
        const col = await this.getCollection(collectionName);
        return col.get({ limit, offset, include: ['documents', 'metadatas'] });
    }
    async deleteDocuments(collectionName, ids) {
        const col = await this.getCollection(collectionName);
        await col.delete({ ids });
    }
    async countDocuments(collectionName) {
        var _a, _b;
        const col = await this.getCollection(collectionName);
        const res = await col.get({ limit: 1000000, include: [] });
        return (_b = (_a = res === null || res === void 0 ? void 0 : res.ids) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
    }
    async deleteCollection(collectionName) {
        try {
            await this.client.deleteCollection({ name: collectionName });
        }
        catch (err) {
            this.logger.warn(`deleteCollection ${collectionName} failed: ${err}`);
        }
    }
};
exports.ChromaService = ChromaService;
exports.ChromaService = ChromaService = ChromaService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], ChromaService);
//# sourceMappingURL=chroma.service.js.map