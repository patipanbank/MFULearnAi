import { Job } from 'bullmq';
import mongoose from 'mongoose';
import { Knowledge } from './models';
import { ChromaClient } from 'chromadb';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { minioClient, MINIO_BUCKET } from './minioClient';
import { getEmbedding, chunkText } from './processingUtils';
import crypto from 'crypto';
import dotenv from 'dotenv';
import axios from 'axios';
import FormData from 'form-data';

// PDF.js Setup (ESM Dynamic Import in function)
// Version 5.x is ESM only. We will import it dynamically.
// const pdfjsLib = ... (loaded inside)


dotenv.config();

const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://ocr-service:5000';
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

import LogEntry from '../infra/logger/models/LogEntry';

export const processKnowledgeJob = async (job: Job) => {
    const { knowledgeId, s3Key, mimetype, originalName } = job.data;
    console.log(`[Worker] Processing Job ${job.id}: ${originalName} (${knowledgeId})`);

    try {
        // 1. Update Status to Processing
        await Knowledge.findByIdAndUpdate(knowledgeId, {
            processingStatus: 'processing',
            processingStage: 'extracting',
            errorReason: ''
        });

        // 2. Download from MinIO
        const stream = await minioClient.getObject(MINIO_BUCKET, s3Key);
        const buffer = await streamToBuffer(stream);

        // Update Size Metadata if missing
        await Knowledge.findByIdAndUpdate(knowledgeId, { s3Size: buffer.length });

        // 3. Extract Text & Metadata
        let pages: { text: string, pageNumber: number }[] = [];
        let fullText = '';

        if (mimetype === 'application/pdf') {
            // Basic PDF parsing with PDF.js for Page awareness
            // Dynamic Import for ESM Module in CJS environment
            const importDynamic = new Function('modulePath', 'return import(modulePath)');
            // Use LEGACY build for Node.js environment (v5.x)
            const pdfjs = await importDynamic('pdfjs-dist/legacy/build/pdf.mjs');

            // for nodejs we need to set standard font data?
            // Some recent versions require this.
            // If it fails again, we might need a canvas polyfill, but legacy build usually avoids this for text.

            // For scanned PDFs, this text will be empty.
            const loadingTask = pdfjs.getDocument({
                data: new Uint8Array(buffer), // Ensure Uint8Array
                useSystemFonts: true, // Use system fonts to avoid font download errors if possible 
                disableFontFace: true // Disable font face if causing issues in Node
            });

            const pdfDocument = await loadingTask.promise;
            const numPages = pdfDocument.numPages;

            // Suppress PDF.js warnings (e.g. TT: undefined function)
            const originalWarn = console.warn;
            console.warn = (...args) => {
                if (args[0] && typeof args[0] === 'string' && args[0].includes('TT: undefined function')) return;
                originalWarn.apply(console, args);
            };

            try {
                for (let i = 1; i <= numPages; i++) {
                    const page = await pdfDocument.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map((item: any) => item.str).join(' ');

                    pages.push({ text: pageText, pageNumber: i });
                    fullText += pageText + '\n\n';
                }
            } finally {
                console.warn = originalWarn; // Restore
            }

            // OCR FALLBACK CHECK
            const nonEmptyPages = pages.filter(p => p.text.replace(/\s/g, '').length > 50).length;
            // If fewer than 50% of pages have text > 50 chars, assume scanned.
            const isScanned = (nonEmptyPages / numPages) < 0.5;

            if (isScanned) {
                console.log(`[Worker] PDF appears scanned (or empty). Sending to OCR Service...`);
                await Knowledge.findByIdAndUpdate(knowledgeId, { processingStage: 'extracting (OCR)' });

                // Send to OCR Service (Direct MinIO Access)
                // Much more efficient: Pass the key, let OCR service fetch it.
                const response = await axios.post(`${OCR_SERVICE_URL}/ocr-bucket`, {
                    bucket: MINIO_BUCKET,
                    key: s3Key
                });

                fullText = response.data.text;
                // Re-parse pages from OCR response? 
                // Our OCR service returns full text with "--- Page X ---" delimiters. 
                // Let's simple-split it for page metadata for now.
                pages = fullText.split('--- Page ').slice(1).map(p => {
                    const [num, ...rest] = p.split(' ---');
                    return { pageNumber: parseInt(num), text: rest.join(' ---') };
                });
            }

        } else if (mimetype === 'image/png' || mimetype === 'image/jpeg' || mimetype === 'image/tiff') {
            // Direct OCR for images
            console.log(`[Worker] Image detected. Sending to OCR...`);
            const response = await axios.post(`${OCR_SERVICE_URL}/ocr-bucket`, {
                bucket: MINIO_BUCKET,
                key: s3Key
            });
            fullText = response.data.text;
            pages = [{ text: fullText, pageNumber: 1 }];

        } else if (mimetype === 'text/plain') {
            fullText = buffer.toString('utf-8');
            pages = [{ text: fullText, pageNumber: 1 }];
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer });
            fullText = result.value;
            pages = [{ text: fullText, pageNumber: 1 }]; // Docx doesn't easily give pages without rendering
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
                const sheetText = `\n--- Sheet: ${name} ---\n${csv}`;
                fullText += sheetText;
                pages.push({ text: sheetText, pageNumber: 1 });
            });
        }
        else {
            // Fallback or Error
            throw new Error(`Unsupported mimetype: ${mimetype}`);
        }

        fullText = fullText.replace(/\s+/g, ' ').trim();
        if (!fullText) {
            const msg = 'File contains no extractable text. Please ensure the file is not empty and contains readable text (or use OCR for images).';
            console.warn(`[Worker] Job ${job.id}: ${msg}`);
            await Knowledge.findByIdAndUpdate(knowledgeId, {
                processingStatus: 'failed',
                errorReason: msg,
                processingStage: 'completed'
            });
            return; // Mark job as done (do not retry)
        }

        // Calculate Hash
        const hash = crypto.createHash('sha256').update(fullText).digest('hex');

        // 4. Update Content & Hash
        await Knowledge.findByIdAndUpdate(knowledgeId, {
            content: fullText,
            textHash: hash,
            processingStage: 'chunking'
        });

        // 5. Vectorize with Page Metadata
        const ids = [], embeddings = [], metadatas = [], documents = [];

        // Chunk each page separately to preserve page context? 
        // Or Chunk full text? 
        // Better: Chunk per page to keep correct page numbers.
        let chunkGlobalIndex = 0;

        for (const p of pages) {
            const pageChunks = await chunkText(p.text);
            for (const chunk of pageChunks) {
                const vec = await getEmbedding(chunk);
                ids.push(`${knowledgeId}-${chunkGlobalIndex}`);
                embeddings.push(vec);
                documents.push(chunk);
                metadatas.push({
                    knowledgeId: knowledgeId.toString(),
                    source: originalName,
                    pageNumber: p.pageNumber,
                    chunkIndex: chunkGlobalIndex
                });
                chunkGlobalIndex++;
            }
        }

        // Batch add to Chroma (chunks of 100?)
        // Chroma default max batch size is usually fine for reasonable docs.

        await Knowledge.findByIdAndUpdate(knowledgeId, { processingStage: 'indexing' });

        const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION, embeddingFunction: null as any });
        await col.add({ ids, embeddings, metadatas, documents });

        // 6. Complete
        await Knowledge.findByIdAndUpdate(knowledgeId, {
            processingStatus: 'completed',
            processingStage: 'completed'
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
