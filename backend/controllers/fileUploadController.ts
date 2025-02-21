import { Request, Response } from 'express';
import { modelService } from '../services/modelService';
import { chromaService } from '../services/chroma';
import { titanEmbedService } from '../services/titan';

/**
 * Splits file content into smaller chunks.
 * Adjust the logic as needed.
 */
function processFileIntoChunks(buffer: Buffer): string[] {
  const text = buffer.toString('utf-8');
  // Splitting text into chunks of approximately 500 characters.
  return text.match(/.{1,500}/g) || [];
}

/**
 * Controller for handling file uploads.
 *
 * Workflow:
 *  - Extract the file and the model ID (from req.body)
 *  - Split the file into manageable text chunks.
 *  - For each chunk, compute its embedding using Titan.
 *  - For all processed chunks, add them as a batch to the "batch" collection using addDocuments.
 *  - Update the custom model (using modelService.addCollectionToModel) so that the model later includes
 *    this collection when querying for context.
 */
export const uploadFileController = async (req: Request, res: Response): Promise<void> => {
  try {
    // The modelId must be provided (e.g., by the client) to identify which custom model to update.
    const { modelId } = req.body;

    // Assume the file is provided by file upload middleware (such as Multer) on req.file.
    const fileData = req.file;
    if (!fileData) {
      res.status(400).json({ error: "No file uploaded." });
      return;
    }

    // The target collection for this upload.
    const collectionName = "batch"; // Adjust this collection name if needed.

    // Process the file content into smaller text chunks.
    const chunks = processFileIntoChunks(fileData.buffer);
    if (chunks.length === 0) {
      res.status(400).json({ error: "Unable to parse file content." });
      return;
    }

    // Build metadata that will be attached to each chunk.
    const metadata = {
      filename: fileData.originalname,
      uploadedBy: (req as any).user?.id || 'anonymous', // adjust based on your auth implementation
      timestamp: new Date().toISOString(),
    };

    // Prepare the array of document objects for insertion.
    const documents = [];
    for (const chunk of chunks) {
      // Get the embedding for this chunk.
      const embedding = await titanEmbedService.embedText(chunk);

      documents.push({
        text: chunk,
        metadata: {
          ...metadata,
          // Optionally, add additional metadata (like a batchId) here.
        },
        embedding: embedding
      });
    }

    // Use the addDocuments function in your Chroma service to upload all chunks.
    await chromaService.addDocuments(collectionName, documents);

    // Update the custom model so that it includes this collection.
    await modelService.addCollectionToModel(modelId, collectionName);

    res.status(200).json({ message: "File uploaded successfully" });
  } catch (error) {
    console.error("Error in file upload:", error);
    res.status(500).json({ error: (error as Error).message });
  }
}; 