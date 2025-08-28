"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trainingService = exports.TrainingService = void 0;
const uuid_1 = require("uuid");
const chromaService_1 = require("./chromaService");
const bedrockService_1 = require("./bedrockService");
const documentService_1 = require("./documentService");
const webScraperService_1 = require("./webScraperService");
const trainingHistoryService_1 = require("./trainingHistoryService");
const text_splitter_1 = require("langchain/text_splitter");
class TrainingService {
    constructor() {
        this.textSplitter = new text_splitter_1.RecursiveCharacterTextSplitter({
            chunkSize: 1500,
            chunkOverlap: 300,
            separators: ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' ', ''],
        });
    }
    async embedAndStore(text, sourceName, contentType, collectionName, user, modelId) {
        if (!text || !text.trim()) {
            return 0;
        }
        const chunks = await this.splitText(text);
        if (!chunks || chunks.length === 0) {
            return 0;
        }
        try {
            console.log(`🔮 Creating embeddings for ${chunks.length} chunks...`);
            let embeddings = null;
            let retryCount = 0;
            const maxRetries = 3;
            while (retryCount < maxRetries) {
                try {
                    embeddings = await bedrockService_1.bedrockService.createBatchTextEmbeddings(chunks);
                    break;
                }
                catch (embeddingError) {
                    retryCount++;
                    console.error(`❌ Embedding attempt ${retryCount} failed:`, embeddingError);
                    if (retryCount >= maxRetries) {
                        throw new Error(`Failed to create embeddings after ${maxRetries} attempts: ${embeddingError?.message || embeddingError}`);
                    }
                    const waitTime = Math.pow(2, retryCount) * 1000;
                    console.log(`⏳ Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
            if (!embeddings || embeddings.length !== chunks.length) {
                const errorMsg = `Mismatch between chunks (${chunks.length}) and embeddings (${embeddings?.length || 0}) for source ${sourceName}`;
                console.error(`❌ ${errorMsg}`);
                throw new Error(errorMsg);
            }
            console.log(`✅ Successfully created ${embeddings.length} embeddings`);
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
                    createdAt: new Date().toISOString(),
                    chunkIndex: index,
                    chunkSize: chunk.length,
                },
                embedding: embeddings[index],
            }));
            if (documentsToAdd.length > 0) {
                console.log(`💾 Storing ${documentsToAdd.length} documents in ChromaDB...`);
                await chromaService_1.chromaService.addDocuments(collectionName, documentsToAdd);
                console.log(`✅ Successfully stored documents in collection: ${collectionName}`);
            }
            return documentsToAdd.length;
        }
        catch (error) {
            console.error(`❌ Error in embedAndStore for source ${sourceName}:`, {
                error: error?.message || error,
                chunksCount: chunks?.length || 0,
                contentType,
                collectionName
            });
            throw error;
        }
    }
    async splitText(text) {
        try {
            console.log(`📝 Splitting text: ${text.length} characters`);
            const chunks = await this.textSplitter.splitText(text);
            console.log(`✂️ Text split into ${chunks.length} chunks`);
            const chunkSizes = chunks.map(chunk => chunk.length);
            const avgSize = chunkSizes.reduce((a, b) => a + b, 0) / chunks.length;
            const maxSize = Math.max(...chunkSizes);
            const minSize = Math.min(...chunkSizes);
            console.log(`📊 Chunk statistics: avg=${Math.round(avgSize)}, min=${minSize}, max=${maxSize}`);
            return chunks.filter(chunk => chunk.trim().length > 0);
        }
        catch (error) {
            console.error('❌ Text splitting failed:', error);
            console.log('🔄 Using fallback text splitting');
            return this.fallbackSplitText(text);
        }
    }
    fallbackSplitText(text) {
        const paragraphs = text.split(/\n\s*\n/);
        const chunks = [];
        for (const paragraph of paragraphs) {
            if (paragraph.trim().length > 0) {
                if (paragraph.length <= 1000) {
                    chunks.push(paragraph.trim());
                }
                else {
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
        }
        return chunks.filter(chunk => chunk.length > 0);
    }
    async parseFileContent(fileBuffer, fileName) {
        return documentService_1.documentService.parseFileContent(fileBuffer, fileName);
    }
    async splitTextWithProgress(text, onProgress) {
        try {
            console.log(`📝 Splitting text: ${text.length} characters`);
            onProgress?.(0);
            const chunks = await this.textSplitter.splitText(text);
            onProgress?.(100);
            console.log(`✂️ Text split into ${chunks.length} chunks`);
            const chunkSizes = chunks.map(chunk => chunk.length);
            const avgSize = chunkSizes.reduce((a, b) => a + b, 0) / chunks.length;
            const maxSize = Math.max(...chunkSizes);
            const minSize = Math.min(...chunkSizes);
            console.log(`📊 Chunk statistics: avg=${Math.round(avgSize)}, min=${minSize}, max=${maxSize}`);
            return chunks.filter(chunk => chunk.trim().length > 0);
        }
        catch (error) {
            console.error('❌ Text splitting failed:', error);
            onProgress?.(50);
            console.log('🔄 Using fallback text splitting');
            const result = this.fallbackSplitText(text);
            onProgress?.(100);
            return result;
        }
    }
    async createEmbeddingsWithProgress(chunks, modelId, onProgress) {
        console.log(`🔮 Creating embeddings for ${chunks.length} chunks...`);
        let embeddings = null;
        let retryCount = 0;
        const maxRetries = 3;
        while (retryCount < maxRetries) {
            try {
                embeddings = await bedrockService_1.bedrockService.createBatchTextEmbeddings(chunks, (completed, total) => {
                    const baseProgress = retryCount * 33;
                    const currentProgress = Math.floor((completed / total) * 67);
                    onProgress?.(baseProgress + currentProgress);
                });
                onProgress?.(100);
                break;
            }
            catch (embeddingError) {
                retryCount++;
                console.error(`❌ Embedding attempt ${retryCount} failed:`, embeddingError);
                if (retryCount >= maxRetries) {
                    throw new Error(`Failed to create embeddings after ${maxRetries} attempts: ${embeddingError?.message || embeddingError}`);
                }
                const waitTime = Math.pow(2, retryCount) * 1000;
                console.log(`⏳ Waiting ${waitTime}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        if (!embeddings || embeddings.length !== chunks.length) {
            const errorMsg = `Mismatch between chunks (${chunks.length}) and embeddings (${embeddings?.length || 0})`;
            console.error(`❌ ${errorMsg}`);
            throw new Error(errorMsg);
        }
        console.log(`✅ Successfully created ${embeddings.length} embeddings`);
        return embeddings;
    }
    async storeDocumentsWithProgress(chunks, embeddings, sourceName, user, modelId, collectionName, onProgress) {
        onProgress?.(10);
        console.log(`💾 Preparing ${chunks.length} documents for storage...`);
        const documentsToAdd = chunks.map((chunk, index) => ({
            id: (0, uuid_1.v4)(),
            document: chunk,
            metadata: {
                source_type: 'file',
                source: sourceName,
                uploadedBy: user?.username || 'system',
                userId: user?._id?.toString() || 'system',
                modelId: modelId,
                collectionName: collectionName,
                createdAt: new Date().toISOString(),
                chunkIndex: index,
                chunkSize: chunk.length,
            },
            embedding: embeddings[index],
        }));
        if (documentsToAdd.length > 0) {
            onProgress?.(25);
            console.log(`💾 Storing ${documentsToAdd.length} documents in ChromaDB...`);
            await chromaService_1.chromaService.addDocuments(collectionName, documentsToAdd, (completed, total) => {
                const storageProgress = Math.floor((completed / total) * 75);
                onProgress?.(25 + storageProgress);
            });
            onProgress?.(100);
            console.log(`✅ Successfully stored documents in collection: ${collectionName}`);
        }
        return documentsToAdd.length;
    }
    async processAndEmbedFile(fileBuffer, fileName, user, modelId, collectionName) {
        if (!fileName) {
            throw new Error('File has no filename.');
        }
        if (!fileBuffer || fileBuffer.length === 0) {
            throw new Error('File buffer is empty.');
        }
        if (!collectionName) {
            throw new Error('Collection name is required.');
        }
        if (fileBuffer.length > 50 * 1024 * 1024) {
            throw new Error('File size exceeds maximum limit of 50MB.');
        }
        const startTime = Date.now();
        try {
            console.log(`📄 Processing file: ${fileName} (${fileBuffer.length} bytes) for collection: ${collectionName}`);
            const textContent = await documentService_1.documentService.parseFileContent(fileBuffer, fileName);
            console.log(`📝 Parsed content length: ${textContent.length} characters`);
            if (!textContent || textContent.trim().length === 0) {
                throw new Error('No readable content found in file.');
            }
            if (textContent.length < 10) {
                throw new Error('File content too short (minimum 10 characters required).');
            }
            const numChunks = await this.embedAndStore(textContent, fileName, 'file', collectionName, user, modelId);
            const processingTime = Date.now() - startTime;
            console.log(`✅ Processed file ${fileName}: ${numChunks} chunks added to collection ${collectionName} in ${processingTime}ms`);
            if (numChunks > 0) {
                try {
                    await trainingHistoryService_1.trainingHistoryService.recordFileUpload(user, collectionName, fileName, fileBuffer.length, numChunks, modelId);
                }
                catch (historyError) {
                    console.warn('⚠️ Failed to record training history:', historyError);
                }
            }
            return numChunks;
        }
        catch (error) {
            const processingTime = Date.now() - startTime;
            console.error(`❌ Error processing file ${fileName} after ${processingTime}ms:`, error);
            throw error;
        }
    }
    async processAndEmbedText(text, documentName, user, modelId, collectionName) {
        try {
            const numChunks = await this.embedAndStore(text, documentName, 'text', collectionName, user, modelId);
            console.log(`Processed text ${documentName}: ${numChunks} chunks added to collection ${collectionName}`);
            if (numChunks > 0) {
                try {
                    await trainingHistoryService_1.trainingHistoryService.recordTextInput(user, collectionName, documentName, numChunks, modelId, text.length);
                }
                catch (historyError) {
                    console.warn('⚠️ Failed to record training history:', historyError);
                }
            }
            return numChunks;
        }
        catch (error) {
            console.error(`Error processing text ${documentName}:`, error);
            throw error;
        }
    }
    async processAndEmbedUrl(url, user, modelId, collectionName) {
        try {
            console.log(`🌐 Processing URL: ${url} for collection: ${collectionName}`);
            const validation = await webScraperService_1.webScraperService.validateUrl(url);
            if (!validation.valid) {
                throw new Error(`Invalid URL: ${validation.error}`);
            }
            const textContent = await webScraperService_1.webScraperService.scrapeUrl(url);
            console.log(`📝 Scraped content length: ${textContent.length} characters`);
            if (!textContent || textContent.trim().length === 0) {
                throw new Error('No readable content found from URL.');
            }
            if (textContent.length < 10) {
                throw new Error('URL content too short (minimum 10 characters required).');
            }
            const numChunks = await this.embedAndStore(textContent, url, 'url', collectionName, user, modelId);
            console.log(`✅ Processed URL ${url}: ${numChunks} chunks added to collection ${collectionName}`);
            if (numChunks > 0) {
                try {
                    await trainingHistoryService_1.trainingHistoryService.recordUrlScraping(user, collectionName, url, numChunks, modelId, textContent.length);
                }
                catch (historyError) {
                    console.warn('⚠️ Failed to record training history:', historyError);
                }
            }
            return numChunks;
        }
        catch (error) {
            console.error(`❌ Error processing URL ${url}:`, error);
            throw error;
        }
    }
}
exports.TrainingService = TrainingService;
exports.trainingService = new TrainingService();
//# sourceMappingURL=trainingService.js.map