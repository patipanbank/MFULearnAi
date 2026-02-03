import { Job } from 'bullmq';
import mongoose from 'mongoose';
import { ChromaClient } from 'chromadb';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { minioClient, MINIO_BUCKET } from './minioClient';
import { getEmbedding, chunkText } from './processingUtils';
import dotenv from 'dotenv';

dotenv.config();

const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
const chroma = new ChromaClient({ path: CHROMA_URL });
const GLOBAL_CHROMA_COLLECTION = "mfulearnai-global-kb";

// We need to import the Model here or pass it. 
// Ideally we share the model definition. 
// For now, let's redefine partial interface or improved import if we split models.
// But to avoid circular deps with server.ts, let's assume we can import the model via mongoose if registered?
// Or we just query directly if we assume connection is open (which it is in server.ts).
// But worker might run separately. 
// Let's rely on mongoose models being registered in server.ts for "Same Process" mode.
// If separate process, we must connect DB here.

// For "Same Process" Architecture:
const Knowledge = mongoose.model('Knowledge');

export const processKnowledgeJob = async (job: Job) => {
    const { knowledgeId, s3Key, mimetype, originalName } = job.data;
    console.log(`[Worker] Processing Job ${job.id}: ${originalName} (${knowledgeId})`);

    try {
        // 1. Update Status to Processing
        await Knowledge.findByIdAndUpdate(knowledgeId, {
            processingStatus: 'processing',
            errorReason: ''
        });

        // 2. Download from MinIO
        const stream = await minioClient.getObject(MINIO_BUCKET, s3Key);
        const buffer = await streamToBuffer(stream);

        // 3. Extract Text
        let text = '';
        if (mimetype === 'application/pdf') {
            text = (await pdf(buffer)).text;
        } else if (mimetype === 'text/plain') {
            text = buffer.toString('utf-8');
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
        } else if (
            mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimetype === 'application/vnd.ms-excel' ||
            mimetype === 'text/csv' ||
            originalName.endsWith('.xlsx') || originalName.endsWith('.csv')
        ) {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheetNames = workbook.SheetNames;
            sheetNames.forEach(name => {
                const sheet = workbook.Sheets[name];
                const csv = XLSX.utils.sheet_to_csv(sheet);
                text += `\n--- Sheet: ${name} ---\n${csv}`;
            });
        } else {
            throw new Error(`Unsupported mimetype: ${mimetype}`);
        }

        text = text.replace(/\s+/g, ' ').trim();
        if (!text) throw new Error('Extracted text is empty');

        // 4. Update Content in DB (Optional, or just keep in vectorstore? The original plan said store full text)
        // Let's store it.
        await Knowledge.findByIdAndUpdate(knowledgeId, { content: text });

        // 5. Vectorize
        const chunks = chunkText(text);
        const ids = [], embeddings = [], metadatas = [], documents = [];

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const vec = await getEmbedding(chunk);
            ids.push(`${knowledgeId}-${i}`);
            embeddings.push(vec);
            documents.push(chunk);
            metadatas.push({
                knowledgeId: knowledgeId.toString(),
                source: originalName,
                chunkIndex: i
            });
        }

        const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION });
        await col.add({ ids, embeddings, metadatas, documents });

        // 6. Complete
        await Knowledge.findByIdAndUpdate(knowledgeId, {
            processingStatus: 'completed'
        });
        console.log(`[Worker] Job ${job.id} Success.`);

    } catch (err: any) {
        console.error(`[Worker] Job ${job.id} Failed:`, err);
        await Knowledge.findByIdAndUpdate(knowledgeId, {
            processingStatus: 'failed',
            errorReason: err.message
        });
        throw err; // Retry in BullMQ?
    }
};

const streamToBuffer = (stream: any): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', (chunk: any) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (err: any) => reject(err));
    });
};
