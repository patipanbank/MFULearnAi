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
dotenv.config();

const CHROMA_URL = process.env.CHROMA_URL || 'http://chromadb:8000';
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://ocr-service:5000';
const chroma = new ChromaClient({ path: CHROMA_URL });
const GLOBAL_CHROMA_COLLECTION = "mfulearnai-global-kb";

export const processKnowledgeJob = async (job: Job) => {
    if (job.name === 'process-url') {
        const { knowledgeId, url } = job.data;
        console.log(`[Worker] Processing URL Job ${job.id}: ${url} (${knowledgeId})`);

        try {
            await Knowledge.findByIdAndUpdate(knowledgeId, {
                processingStatus: 'processing',
                processingStage: 'extracting',
                errorReason: ''
            }, { new: true });

            console.log(`[Worker] Fetching URL: ${url}`);

            // 1. Fetch HTML
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                timeout: 15000
            });
            const html = response.data;

            // 2. Parse and Clean with Cheerio
            const cheerio = require('cheerio');
            const $ = cheerio.load(html);
            // Remove noise
            $('script, style, nav, footer, header, aside, .sidebar, .menu, iframe').remove();

            let title = $('title').text().trim();
            if (!title) {
                const h1 = $('h1').first().text().trim();
                if (h1) title = h1;
            }
            if (title) {
                await Knowledge.findByIdAndUpdate(knowledgeId, { title: title.substring(0, 100) });
            }

            const cleanHtml = $('body').html() || '';

            // 3. Convert to Markdown
            const TurndownService = require('turndown');
            const turndownService = new TurndownService({ headingStyle: 'atx' });
            let markdown = turndownService.turndown(cleanHtml);

            // Clean up excessive whitespace
            markdown = markdown.replace(/\n\s*\n/g, '\n\n').trim();

            if (!markdown) throw new Error('No readable content found at URL');

            // 4. Send to standard processing pipeline (same as text files)
            job.data.mimetype = 'text/plain';
            job.data.originalName = url;

            // Save scraped text to a pseudo-buffer to reuse existing logic
            const buffer = Buffer.from(markdown, 'utf-8');

            // Calculate Hash
            const hash = crypto.createHash('sha256').update(markdown).digest('hex');

            // --- Phase 4: Semantic Duplicate Detection (#11) ---
            const duplicateDoc = await Knowledge.findOne({
                _id: { $ne: knowledgeId },
                textHash: hash,
                visibility: 'active',
                processingStatus: 'completed'
            });

            if (duplicateDoc) {
                console.log(`[Worker] Duplicate detected for URL job ${job.id}. Matches doc: ${duplicateDoc._id}`);
                await Knowledge.findByIdAndUpdate(knowledgeId, {
                    processingStatus: 'failed',
                    processingStage: 'completed',
                    errorReason: `Duplicate content detected. Identical content already exists in document: "${duplicateDoc.title}"`,
                    s3Size: buffer.length,
                    textHash: hash
                });
                return;
            }
            // --------------------------------------------------

            // Update Content
            const knowledgeDoc = await Knowledge.findByIdAndUpdate(knowledgeId, {
                content: markdown,
                textHash: hash,
                processingStage: 'chunking',
                s3Size: buffer.length
            });

            const docType = knowledgeDoc?.type || 'personal';

            // 5. Vectorize directly
            const pages = [{ text: markdown, pageNumber: 1 }];
            const ids = [], embeddings = [], metadatas = [], documents = [];
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
                        source: url,
                        type: docType,
                        fileName: url,
                        pageNumber: p.pageNumber,
                        chunkIndex: chunkGlobalIndex
                    });
                    chunkGlobalIndex++;
                }
            }

            await Knowledge.findByIdAndUpdate(knowledgeId, { processingStage: 'indexing' });

            const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION, embeddingFunction: null as any });
            await col.add({ ids, embeddings, metadatas, documents });

            // 6. Complete
            await Knowledge.findByIdAndUpdate(knowledgeId, {
                processingStatus: 'completed',
                processingStage: 'completed'
            });
            console.log(`[Worker] URL Job ${job.id} Success.`);
            return;

        } catch (err: any) {
            console.error(`[Worker] URL Job ${job.id} Failed:`, err);
            await Knowledge.findByIdAndUpdate(knowledgeId, {
                processingStatus: 'failed',
                errorReason: err.message
            } as any);
            throw err;
        }
    }


    const { knowledgeId, s3Key, mimetype, originalName } = job.data;
    console.log(`[Worker] Processing Job ${job.id}: ${originalName} (${knowledgeId})`);

    try {
        // 1. Update Status to Processing & get document type
        const knowledgeDoc = await Knowledge.findByIdAndUpdate(knowledgeId, {
            processingStatus: 'processing',
            processingStage: 'extracting',
            errorReason: ''
        }, { new: true });

        if (!knowledgeDoc) {
            console.error(`[Worker] Knowledge ID ${knowledgeId} not found in DB!`);
            return;
        }

        console.log(`[Worker] Updated status to processing for ${knowledgeId}`);

        const docType = knowledgeDoc?.type || 'personal'; // Used in chunk metadata for filtering

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
            const importDynamic = new Function('modulePath', 'return import(modulePath)');
            const pdfjs = await importDynamic('pdfjs-dist/legacy/build/pdf.mjs');

            const loadingTask = pdfjs.getDocument({
                data: new Uint8Array(buffer),
                useSystemFonts: true,
                disableFontFace: true
            });

            const pdfDocument = await loadingTask.promise;
            const numPages = pdfDocument.numPages;

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
            const isScanned = (nonEmptyPages / numPages) < 0.5;

            if (isScanned) {
                console.log(`[Worker] PDF appears scanned (or empty). Sending to OCR Service...`);
                await Knowledge.findByIdAndUpdate(knowledgeId, { processingStage: 'extracting (OCR)' });

                const response = await axios.post(`${OCR_SERVICE_URL}/ocr-bucket`, {
                    bucket: MINIO_BUCKET,
                    key: s3Key
                });

                fullText = response.data.text;
                pages = fullText.split('--- Page ').slice(1).map(p => {
                    const [num, ...rest] = p.split(' ---');
                    return { pageNumber: parseInt(num), text: rest.join(' ---') };
                });
            }

        } else if (mimetype === 'image/png' || mimetype === 'image/jpeg' || mimetype === 'image/tiff') {
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
            pages = [{ text: fullText, pageNumber: 1 }];
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
            return;
        }

        // Calculate Hash
        const hash = crypto.createHash('sha256').update(fullText).digest('hex');

        // --- Phase 4: Semantic Duplicate Detection (#11) ---
        const duplicateDoc = await Knowledge.findOne({
            _id: { $ne: knowledgeId },
            textHash: hash,
            visibility: 'active',
            processingStatus: 'completed'
        });

        if (duplicateDoc) {
            console.log(`[Worker] Duplicate detected for job ${job.id}. Matches doc: ${duplicateDoc._id}`);
            await Knowledge.findByIdAndUpdate(knowledgeId, {
                processingStatus: 'failed',
                processingStage: 'completed',
                errorReason: `Duplicate content detected. Identical content already exists in document: "${duplicateDoc.title}"`,
                textHash: hash
            });
            return;
        }
        // --------------------------------------------------

        // 4. Update Content & Hash
        await Knowledge.findByIdAndUpdate(knowledgeId, {
            content: fullText,
            textHash: hash,
            processingStage: 'chunking'
        });

        // 5. Vectorize with Page Metadata
        const ids = [], embeddings = [], metadatas = [], documents = [];
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
                    type: docType,           // Critical: enables PolicyCheckerTool { type: 'policy' } filter
                    fileName: originalName,   // Alias for consistent metadata access
                    pageNumber: p.pageNumber,
                    chunkIndex: chunkGlobalIndex
                });
                chunkGlobalIndex++;
            }
        }

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
        try {
            await Knowledge.findByIdAndUpdate(knowledgeId, {
                processingStatus: 'failed',
                errorReason: err.message
            } as any);
        } catch (dbErr) {
            console.error(`[Worker] Failed to update status to failed for ${knowledgeId}`, dbErr);
        }
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
