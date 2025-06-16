"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hierarchicalEmbeddingService = void 0;
// This will house the new Hierarchical RAG embedding logic.
// It will orchestrate the creation of L0, L1, and L2 summaries.
const Collection_1 = require("../models/Collection");
const Document_1 = require("../models/Document");
const document_1 = require("./document");
const chroma_1 = require("./chroma");
const titan_1 = require("./titan");
const bedrock_1 = require("./bedrock");
const textUtils_1 = require("../utils/textUtils");
class HierarchicalEmbeddingService {
    /**
     * Main function to process a file and embed it hierarchically.
     * @param file The uploaded file from Multer.
     * @param collectionId The ID of the collection to add the document to.
     * @param user The user who uploaded the file.
     */
    async processAndEmbedFile(file, collectionId, user) {
        // 1. Get collection name from MongoDB
        const collection = await Collection_1.CollectionModel.findById(collectionId);
        if (!collection) {
            throw new Error(`Collection with ID ${collectionId} not found`);
        }
        const collectionName = collection.name;
        // 2. Create a document record in MongoDB
        const documentRecord = await Document_1.DocumentModel.create({
            name: file.originalname,
            collectionId: collectionId,
            status: Document_1.DocumentStatus.PROCESSING,
            createdBy: user.username || user.nameID,
        });
        const documentId = documentRecord._id.toString();
        try {
            // 3. Extract text and create L0 chunks
            const fullText = await document_1.documentService.processFile(file);
            const chunks = (0, textUtils_1.splitTextIntoChunks)(fullText);
            // 4. Embed and store L0 chunks in ChromaDB
            const documentsToStore = await Promise.all(chunks.map(async (chunk, index) => {
                const embedding = await titan_1.titanEmbedService.embedText(chunk);
                return {
                    text: chunk,
                    metadata: {
                        documentId: documentId,
                        collectionId: collectionId,
                        collectionName: collectionName,
                        chunkNumber: index,
                        filename: file.originalname,
                        uploadedBy: user.username || user.nameID,
                        timestamp: new Date().toISOString(),
                    },
                    embedding: embedding,
                };
            }));
            await chroma_1.chromaService.addDocuments(collectionName, documentsToStore);
            // 4. Generate L1 Document Summary
            const l1Summary = await this.generateDocumentSummary(fullText);
            // 5. Update the document record with the summary and set status to COMPLETED
            await Document_1.DocumentModel.findByIdAndUpdate(documentId, {
                summary: l1Summary,
                status: Document_1.DocumentStatus.COMPLETED,
            });
            // 6. Trigger L2 Collection Summary update (asynchronously)
            this.updateCollectionSummary(collectionId).catch(err => {
                console.error(`Failed to update collection summary for ${collectionId}`, err);
            });
        }
        catch (error) {
            console.error(`Failed to process file for document ${documentId}`, error);
            // Mark document as FAILED
            await Document_1.DocumentModel.findByIdAndUpdate(documentId, {
                status: Document_1.DocumentStatus.FAILED,
            });
            throw error; // Re-throw the error to be handled by the route
        }
    }
    /**
     * Generates a summary for a single document's full text.
     * @param fullText The entire text content of a document.
     * @returns A concise summary.
     */
    async generateDocumentSummary(fullText) {
        const prompt = `Please provide a concise, dense summary of the following document. Focus on the key topics, entities, and overall purpose. The summary should be a single paragraph.

Document:
"""
${fullText.substring(0, 15000)}
"""

Summary:`;
        const summary = await bedrock_1.bedrockService.invokeForText(prompt, bedrock_1.bedrockService.models.claude35, 1024);
        return summary;
    }
    /**
     * Updates the summary for an entire collection based on its documents.
     * @param collectionId The ID of the collection to update.
     */
    async updateCollectionSummary(collectionId) {
        // Get all completed document summaries for the collection
        const documents = await Document_1.DocumentModel.find({
            collectionId: collectionId,
            status: Document_1.DocumentStatus.COMPLETED,
        }).select('summary').lean();
        if (documents.length === 0) {
            // No documents to summarize, maybe clear the summary
            await Collection_1.CollectionModel.findByIdAndUpdate(collectionId, { summary: '' });
            return;
        }
        const allSummaries = documents.map(doc => doc.summary).join('\n\n---\n\n');
        const prompt = `The following are summaries of individual documents within a collection. Synthesize them into a single, cohesive, overarching summary that describes the entire collection.

Summaries:
"""
${allSummaries}
"""

Cohesive Collection Summary:`;
        const l2Summary = await bedrock_1.bedrockService.invokeForText(prompt, bedrock_1.bedrockService.models.claude35, 2048);
        await Collection_1.CollectionModel.findByIdAndUpdate(collectionId, {
            summary: l2Summary,
        });
        console.log(`Successfully updated L2 summary for collection ${collectionId}`);
    }
}
exports.hierarchicalEmbeddingService = new HierarchicalEmbeddingService();
