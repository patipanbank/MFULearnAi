// This will house the new Hierarchical RAG embedding logic.
// It will orchestrate the creation of L0, L1, and L2 summaries.
import { CollectionModel } from '../models/Collection';
import { DocumentModel, DocumentStatus } from '../models/Document';
import { documentService } from './document';
import { chromaService } from './chroma';
import { titanEmbedService } from './titan';
import { bedrockService } from './bedrock';
import { splitTextIntoChunks } from '../utils/textUtils';

class HierarchicalEmbeddingService {

  /**
   * Main function to process a file and embed it hierarchically.
   * @param file The uploaded file from Multer.
   * @param collectionId The ID of the collection to add the document to.
   * @param user The user who uploaded the file.
   */
  public async processAndEmbedFile(file: Express.Multer.File, collectionId: string, user: any): Promise<void> {
    // 1. Get collection name from MongoDB
    const collection = await CollectionModel.findById(collectionId);
    if (!collection) {
      throw new Error(`Collection with ID ${collectionId} not found`);
    }
    const collectionName = collection.name;

    // 2. Create a document record in MongoDB
    const documentRecord = await DocumentModel.create({
      name: file.originalname,
      collectionId: collectionId,
      status: DocumentStatus.PROCESSING,
      createdBy: user.username || user.nameID,
    });
    const documentId = (documentRecord as any)._id.toString();

    try {
      // 3. Extract text and create L0 chunks
      const fullText = await documentService.processFile(file);
      const chunks = splitTextIntoChunks(fullText);

      // 4. Embed and store L0 chunks in ChromaDB
      const documentsToStore = await Promise.all(chunks.map(async (chunk, index) => {
        const embedding = await titanEmbedService.embedText(chunk);
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

      await chromaService.addDocuments(collectionName, documentsToStore);

      // 4. Generate L1 Document Summary
      const l1Summary = await this.generateDocumentSummary(fullText);
      
      // 5. Update the document record with the summary and set status to COMPLETED
      await DocumentModel.findByIdAndUpdate(documentId, {
        summary: l1Summary,
        status: DocumentStatus.COMPLETED,
      });

      // 6. Trigger L2 Collection Summary update (asynchronously)
      this.updateCollectionSummary(collectionId).catch(err => {
        console.error(`Failed to update collection summary for ${collectionId}`, err);
      });

    } catch (error) {
      console.error(`Failed to process file for document ${documentId}`, error);
      // Mark document as FAILED
      await DocumentModel.findByIdAndUpdate(documentId, {
        status: DocumentStatus.FAILED,
      });
      throw error; // Re-throw the error to be handled by the route
    }
  }

  /**
   * Generates a summary for a single document's full text.
   * @param fullText The entire text content of a document.
   * @returns A concise summary.
   */
  private async generateDocumentSummary(fullText: string): Promise<string> {
    const prompt = `Please provide a concise, dense summary of the following document. Focus on the key topics, entities, and overall purpose. The summary should be a single paragraph.

Document:
"""
${fullText.substring(0, 15000)}
"""

Summary:`;

    const summary = await bedrockService.invokeForText(prompt, bedrockService.models.claude35, 1024);
    return summary;
  }

  /**
   * Updates the summary for an entire collection based on its documents.
   * @param collectionId The ID of the collection to update.
   */
  public async updateCollectionSummary(collectionId: string): Promise<void> {
    // Get all completed document summaries for the collection
    const documents = await DocumentModel.find({
      collectionId: collectionId,
      status: DocumentStatus.COMPLETED,
    }).select('summary').lean();

    if (documents.length === 0) {
      // No documents to summarize, maybe clear the summary
      await CollectionModel.findByIdAndUpdate(collectionId, { summary: '' });
      return;
    }

    const allSummaries = documents.map(doc => doc.summary).join('\n\n---\n\n');

    const prompt = `The following are summaries of individual documents within a collection. Synthesize them into a single, cohesive, overarching summary that describes the entire collection.

Summaries:
"""
${allSummaries}
"""

Cohesive Collection Summary:`;
    
    const l2Summary = await bedrockService.invokeForText(prompt, bedrockService.models.claude35, 2048);

    await CollectionModel.findByIdAndUpdate(collectionId, {
      summary: l2Summary,
    });

    console.log(`Successfully updated L2 summary for collection ${collectionId}`);
  }
}

export const hierarchicalEmbeddingService = new HierarchicalEmbeddingService(); 