"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trainingService = exports.TrainingService = void 0;
const uuid_1 = require("uuid");
const chromaService_1 = require("./chromaService");
const bedrockService_1 = require("./bedrockService");
const documentService_1 = require("./documentService");
class TrainingService {
    constructor() {
    }
    async embedAndStore(text, sourceName, contentType, collectionName, user, modelId) {
        if (!text || !text.trim()) {
            return 0;
        }
        const chunks = this.splitText(text);
        if (!chunks || chunks.length === 0) {
            return 0;
        }
        try {
            const embeddings = await bedrockService_1.bedrockService.createBatchTextEmbeddings(chunks);
            if (!embeddings || embeddings.length !== chunks.length) {
                console.error(`Error: Mismatch between number of chunks (${chunks.length}) and embeddings (${embeddings?.length || 0}) for source ${sourceName}`);
                return 0;
            }
            const documentsToAdd = chunks.map((chunk, index) => ({
                id: (0, uuid_1.v4)(),
                document: chunk,
                metadata: {
                    source_type: contentType,
                    source: sourceName,
                    uploadedBy: user?.username || 'system',
                    userId: user?._id?.toString() || 'system',
                    modelId: modelId,
                    collectionName: collectionName,
                },
                embedding: embeddings[index],
            }));
            if (documentsToAdd.length > 0) {
                await chromaService_1.chromaService.addDocuments(collectionName, documentsToAdd);
            }
            return documentsToAdd.length;
        }
        catch (error) {
            console.error('Error in embedAndStore:', error);
            throw error;
        }
    }
    splitText(text) {
        const paragraphs = text.split(/\n\s*\n/);
        const chunks = [];
        for (const paragraph of paragraphs) {
            if (paragraph.trim().length > 0) {
                const sentences = paragraph.split(/[.!?]+/);
                let currentChunk = '';
                for (const sentence of sentences) {
                    const trimmed = sentence.trim();
                    if (trimmed.length > 0) {
                        if (currentChunk.length + trimmed.length > 1000) {
                            if (currentChunk.length > 0) {
                                chunks.push(currentChunk.trim());
                                currentChunk = '';
                            }
                        }
                        currentChunk += (currentChunk ? ' ' : '') + trimmed;
                    }
                }
                if (currentChunk.length > 0) {
                    chunks.push(currentChunk.trim());
                }
            }
        }
        return chunks;
    }
    async processAndEmbedFile(fileBuffer, fileName, user, modelId, collectionName) {
        if (!fileName) {
            throw new Error('File has no filename.');
        }
        try {
            const textContent = await documentService_1.documentService.parseFileContent(fileBuffer, fileName);
            const numChunks = await this.embedAndStore(textContent, fileName, 'file', collectionName, user, modelId);
            console.log(`Processed file ${fileName}: ${numChunks} chunks added to collection ${collectionName}`);
            return numChunks;
        }
        catch (error) {
            console.error(`Error processing file ${fileName}:`, error);
            throw error;
        }
    }
    async processAndEmbedText(text, documentName, user, modelId, collectionName) {
        try {
            const numChunks = await this.embedAndStore(text, documentName, 'text', collectionName, user, modelId);
            console.log(`Processed text ${documentName}: ${numChunks} chunks added to collection ${collectionName}`);
            return numChunks;
        }
        catch (error) {
            console.error(`Error processing text ${documentName}:`, error);
            throw error;
        }
    }
}
exports.TrainingService = TrainingService;
exports.trainingService = new TrainingService();
//# sourceMappingURL=trainingService.js.map