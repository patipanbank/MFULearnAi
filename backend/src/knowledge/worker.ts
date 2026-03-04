import { Job } from 'bullmq';
import { Knowledge } from './models';
import { ChromaClient } from 'chromadb';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { minioClient, MINIO_BUCKET } from './minioClient';
import { getEmbedding, chunkText } from './processingUtils';
import crypto from 'crypto';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import chardet from 'chardet';
import { LoggerService } from '../services/LoggerService';
import { CHROMA_URL, GLOBAL_CHROMA_COLLECTION, OCR_SERVICE_URL } from './constants';
import { validateUrlSafety, MAX_URL_RESPONSE_BYTES, MAX_URL_REDIRECTS, URL_FETCH_TIMEOUT_MS } from '../utils/ssrfGuard';

dotenv.config();

const chroma = new ChromaClient({ path: CHROMA_URL });

/** Shared User-Agent for all outbound HTTP requests */
const FETCH_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) MFULearnAI/1.0';

/** Safe axios defaults for URL fetching — prevents OOM and redirect exploits */
const safeAxiosDefaults = {
    headers: { 'User-Agent': FETCH_USER_AGENT },
    timeout: URL_FETCH_TIMEOUT_MS,
    maxRedirects: MAX_URL_REDIRECTS,
    maxContentLength: MAX_URL_RESPONSE_BYTES,
    maxBodyLength: MAX_URL_RESPONSE_BYTES,
};

export const processKnowledgeJob = async (job: Job) => {
    if (job.name === 'process-url') {
        const { knowledgeId, url } = job.data;
        LoggerService.info('worker_url_job_start', { jobId: job.id, url, knowledgeId });

        // Idempotency guard: skip if doc already completed or being processed by another job
        try {
            const current = await Knowledge.findById(knowledgeId).select('processingStatus processingStage').lean();
            if (current?.processingStatus === 'completed') {
                LoggerService.warn('worker_skip_already_completed', { jobId: job.id, knowledgeId });
                return; // Already done — no-op
            }
            if (current?.processingStatus === 'processing' && job.attemptsMade === 0) {
                // Another job is actively processing this doc (stalled recovery race)
                // Only skip on first attempt — retries should proceed
                const existingStage = current?.processingStage;
                if (existingStage && existingStage !== 'queued' && existingStage !== 'failed') {
                    LoggerService.warn('worker_skip_concurrent_processing', {
                        jobId: job.id, knowledgeId, existingStage
                    });
                    return;
                }
            }
        } catch (guardErr: any) {
            LoggerService.warn('worker_idempotency_check_failed', { error: guardErr.message });
            // Fail open — proceed with processing
        }

        try {
            // Defense-in-depth: Re-validate URL safety in worker (controller already checked,
            // but this prevents exploitation via direct queue injection or DB tampering)
            const urlCheck = validateUrlSafety(url);
            if (!urlCheck.safe) {
                LoggerService.error('worker_url_ssrf_blocked', { jobId: job.id, url, reason: urlCheck.reason });
                await Knowledge.findByIdAndUpdate(knowledgeId, {
                    processingStatus: 'failed',
                    processingStage: 'failed',
                    errorReason: `URL blocked: ${urlCheck.reason}`
                });
                return; // Don't throw — this should not be retried
            }

            await Knowledge.findByIdAndUpdate(knowledgeId, {
                processingStatus: 'processing',
                processingStage: 'extracting',
                errorReason: ''
            }, { new: true });

            LoggerService.debug('worker_fetching_url', { url });

            let markdown = '';

            // --- Google Drive document detection ---
            const googleSheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
            const googleDocsMatch   = url.match(/docs\.google\.com\/document\/d\/([\w-]+)/);
            const googleSlidesMatch = url.match(/docs\.google\.com\/presentation\/d\/([\w-]+)/);

            if (googleSheetsMatch) {
                // 1a. Google Sheets — try XLSX export first, fall back to gviz CSV
                // The /export endpoint requires a logged-in session for "Anyone with link" sheets.
                // The gviz/tq endpoint works without auth for "Anyone with link" sheets.
                const sheetId = googleSheetsMatch[1];
                LoggerService.info('worker_google_sheets_detected', { jobId: job.id, sheetId });

                let parsedTitle: string | undefined;

                // ── Attempt 1: XLSX export (works when sheet is "Published to the web") ──
                let xlsxOk = false;
                try {
                    const xlsxUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;
                    const xlsxRes = await axios.get(xlsxUrl, {
                        ...safeAxiosDefaults,
                        responseType: 'arraybuffer',
                        validateStatus: (s) => s < 400
                    });
                    const ct: string = xlsxRes.headers['content-type'] || '';
                    if (!ct.includes('text/html')) {
                        const xlsBuffer = Buffer.from(xlsxRes.data);
                        const workbook = XLSX.read(xlsBuffer, { type: 'buffer' });
                        parsedTitle = (workbook.Props as any)?.Title?.trim() || undefined;
                        workbook.SheetNames.forEach(name => {
                            const sheet = workbook.Sheets[name];
                            const csv = XLSX.utils.sheet_to_csv(sheet);
                            if (csv.trim()) markdown += `\n--- Sheet: ${name} ---\n${csv}\n`;
                        });
                        xlsxOk = true;
                        LoggerService.info('worker_google_sheets_xlsx_ok', { jobId: job.id, sheetId });
                    }
                } catch (xlsxErr: any) {
                    LoggerService.warn('worker_google_sheets_xlsx_fallback', { jobId: job.id, reason: xlsxErr.message });
                }

                // ── Attempt 2: gviz/tq CSV (works for "Anyone with link can view") ──
                if (!xlsxOk) {
                    // First fetch default sheet to get at least one sheet worth of data.
                    // Then attempt to enumerate additional sheets via the HTML index page.
                    const gvizBase = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
                    const csvRes = await axios.get(gvizBase, safeAxiosDefaults);
                    const csvText: string = csvRes.data as string;
                    if (!csvText.trim()) throw new Error('Google Sheets returned empty content — check the sheet has data and sharing is set to "Anyone with the link".');
                    markdown = `--- Sheet: Sheet1 ---\n${csvText.trim()}`;

                    // Try to get more sheet names from the sheet's pub page
                    try {
                        const pubUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/pubhtml`;
                        const pubRes = await axios.get(pubUrl, {
                            ...safeAxiosDefaults,
                            timeout: 10000
                        });
                        const $ = cheerio.load(pubRes.data as string);
                        const sheetNames: string[] = [];
                        // Sheet tabs appear as <li id="..."> with data-sheet-id
                        $('[data-sheet-id]').each((_: any, el: any) => {
                            const name = $(el).text().trim();
                            if (name) sheetNames.push(name);
                        });
                        if (sheetNames.length > 1) {
                            // Re-fetch each sheet individually via gviz
                            markdown = '';
                            for (const name of sheetNames) {
                                const sheetCsvRes = await axios.get(`${gvizBase}&sheet=${encodeURIComponent(name)}`, {
                                    ...safeAxiosDefaults,
                                    timeout: 20000
                                });
                                const sheetCsv: string = sheetCsvRes.data as string;
                                if (sheetCsv.trim()) markdown += `\n--- Sheet: ${name} ---\n${sheetCsv.trim()}\n`;
                            }
                            markdown = markdown.trim();
                            // Try to grab doc title from page title
                            const pageTitle = $('title').text().trim();
                            if (pageTitle) parsedTitle = pageTitle.replace(/\s*-\s*Google Sheets.*$/i, '').trim();
                        }
                    } catch (_) { /* sheet enumeration failed — keep default single sheet */ }
                    LoggerService.info('worker_google_sheets_gviz_ok', { jobId: job.id, sheetId });
                }

                const docTitle = parsedTitle || `Google Sheets: ${sheetId}`;
                await Knowledge.findByIdAndUpdate(knowledgeId, { title: docTitle.substring(0, 100) });
                markdown = markdown.trim();

            } else if (googleDocsMatch) {
                // 1b. Google Docs → export as plain text
                const docId = googleDocsMatch[1];
                LoggerService.info('worker_google_docs_detected', { jobId: job.id, docId });

                const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
                const docResponse = await axios.get(exportUrl, safeAxiosDefaults);
                markdown = (docResponse.data as string).trim();

                // Try to grab the doc title from the export URL redirect or fall back
                await Knowledge.findByIdAndUpdate(knowledgeId, { title: `Google Docs: ${docId}`.substring(0, 100) });

            } else if (googleSlidesMatch) {
                // 1c. Google Slides → export as plain text
                const presId = googleSlidesMatch[1];
                LoggerService.info('worker_google_slides_detected', { jobId: job.id, presId });

                const exportUrl = `https://docs.google.com/presentation/d/${presId}/export/txt`;
                const slidesResponse = await axios.get(exportUrl, safeAxiosDefaults);
                markdown = (slidesResponse.data as string).trim();
                await Knowledge.findByIdAndUpdate(knowledgeId, { title: `Google Slides: ${presId}`.substring(0, 100) });

            } else {
                // 1d. Regular webpage → scrape HTML and convert to Markdown
                const response = await axios.get(url, safeAxiosDefaults);
                const html = response.data;

                // 2. Parse and Clean with Cheerio
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
                const turndownService = new TurndownService({ headingStyle: 'atx' });
                markdown = turndownService.turndown(cleanHtml);

                // Clean up excessive whitespace
                markdown = markdown.replace(/\n\s*\n/g, '\n\n').trim();
            }

            if (!markdown) throw new Error('No readable content found at URL');

            // 4. Send to standard processing pipeline (same as text files)
            job.data.mimetype = 'text/plain';
            job.data.originalName = url;

            // Save scraped text to a pseudo-buffer to reuse existing logic
            const buffer = Buffer.from(markdown, 'utf-8');

            // Calculate Hash
            const hash = crypto.createHash('sha256').update(markdown).digest('hex');

            // --- Duplicate Detection ---
            const duplicateDoc = await Knowledge.findOne({
                _id: { $ne: knowledgeId },
                textHash: hash,
                visibility: 'active',
                processingStatus: 'completed'
            });

            if (duplicateDoc) {
                LoggerService.info('worker_duplicate_detected', { jobId: job.id, matchedDoc: duplicateDoc._id });
                await Knowledge.findByIdAndUpdate(knowledgeId, {
                    processingStatus: 'failed',
                    processingStage: 'failed',
                    errorReason: `Duplicate content detected. Identical content already exists in document: "${duplicateDoc.title}"`,
                    s3Size: buffer.length,
                    textHash: hash
                });
                return;
            }

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
            const ids: string[] = [], embeddings: number[][] = [], metadatas: Record<string, string | number>[] = [], documents: string[] = [];
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
                processingStage: 'completed',
                chunkCount: chunkGlobalIndex
            });
            LoggerService.info('worker_url_job_success', { jobId: job.id, chunkCount: chunkGlobalIndex });
            return;

        } catch (err: any) {
            LoggerService.error('worker_url_job_failed', { jobId: job.id, error: err.message, stack: err.stack });
            // Sanitize error message — avoid leaking internal IPs/paths to end users
            const safeError = sanitizeErrorMessage(err.message);
            await Knowledge.findByIdAndUpdate(knowledgeId, {
                processingStatus: 'failed',
                processingStage: 'failed',
                errorReason: safeError
            });
            throw err;
        }
    }


    const { knowledgeId, s3Key, mimetype, originalName } = job.data;
    LoggerService.info('worker_file_job_start', { jobId: job.id, originalName, knowledgeId });

    // Idempotency guard: skip if doc already completed or being processed by another job
    try {
        const current = await Knowledge.findById(knowledgeId).select('processingStatus processingStage').lean();
        if (current?.processingStatus === 'completed') {
            LoggerService.warn('worker_skip_already_completed', { jobId: job.id, knowledgeId });
            return;
        }
        if (current?.processingStatus === 'processing' && job.attemptsMade === 0) {
            const existingStage = current?.processingStage;
            if (existingStage && existingStage !== 'queued' && existingStage !== 'failed') {
                LoggerService.warn('worker_skip_concurrent_processing', {
                    jobId: job.id, knowledgeId, existingStage
                });
                return;
            }
        }
    } catch (guardErr: any) {
        LoggerService.warn('worker_idempotency_check_failed', { error: guardErr.message });
    }

    try {
        // 1. Update Status to Processing & get document type
        const knowledgeDoc = await Knowledge.findByIdAndUpdate(knowledgeId, {
            processingStatus: 'processing',
            processingStage: 'extracting',
            errorReason: ''
        }, { new: true });

        if (!knowledgeDoc) {
            LoggerService.error('worker_knowledge_not_found', { knowledgeId });
            return;
        }

        LoggerService.debug('worker_status_updated', { knowledgeId, status: 'processing' });

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
            // PDF parsing with PDF.js — use standard dynamic import (no new Function hack)
            const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

            const loadingTask = pdfjs.getDocument({
                data: new Uint8Array(buffer),
                useSystemFonts: true,
                disableFontFace: true,
                verbosity: 0  // Suppress PDF.js warnings at the library level
            });

            const pdfDocument = await loadingTask.promise;
            const numPages = pdfDocument.numPages;

            for (let i = 1; i <= numPages; i++) {
                const page = await pdfDocument.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map((item: any) => item.str).join(' ');

                pages.push({ text: pageText, pageNumber: i });
                fullText += pageText + '\n\n';
            }

            // OCR FALLBACK CHECK
            const nonEmptyPages = pages.filter(p => p.text.replace(/\s/g, '').length > 50).length;
            const isScanned = (nonEmptyPages / numPages) < 0.5;

            if (isScanned) {
                LoggerService.info('worker_pdf_scanned_ocr_fallback', { jobId: job.id });
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
            LoggerService.info('worker_image_ocr', { jobId: job.id });
            const response = await axios.post(`${OCR_SERVICE_URL}/ocr-bucket`, {
                bucket: MINIO_BUCKET,
                key: s3Key
            });
            fullText = response.data.text;
            pages = [{ text: fullText, pageNumber: 1 }];

        } else if (
            mimetype.startsWith('text/') ||
            ['txt', 'md', 'html', 'css', 'js', 'ts', 'json', 'xml', 'yaml', 'yml', 'py', 'c', 'cpp', 'h', 'java', 'go', 'rs', 'php', 'rb', 'sh'].some(ext => originalName.toLowerCase().endsWith(`.${ext}`))
        ) {
            const encoding = chardet.detect(buffer) || 'utf-8';
            const decoder = new TextDecoder(encoding as string);
            fullText = decoder.decode(buffer);
            pages = [{ text: fullText, pageNumber: 1 }];
        } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ buffer });
            fullText = result.value;
            pages = [{ text: fullText, pageNumber: 1 }];
        } else if (
            mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            mimetype === 'application/vnd.ms-excel' ||
            originalName.endsWith('.xlsx') || originalName.endsWith('.csv') || originalName.endsWith('.xls')
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
            // Fallback: If it's a known document type but unsupported by the specific parser (e.g. .doc instead of .docx), try raw text extraction
            if (originalName.endsWith('.doc') || originalName.endsWith('.rtf')) {
                const encoding = chardet.detect(buffer) || 'utf-8';
                const decoder = new TextDecoder(encoding as string);
                fullText = decoder.decode(buffer);
                pages = [{ text: fullText, pageNumber: 1 }];
                LoggerService.warn('worker_doc_fallback_text', { jobId: job.id, originalName });
            } else {
                throw new Error(`Unsupported mimetype or extension: ${mimetype} (${originalName})`);
            }
        }

        fullText = fullText.replace(/\s+/g, ' ').trim();
        if (!fullText) {
            const msg = 'File contains no extractable text. Please ensure the file is not empty and contains readable text (or use OCR for images).';
            LoggerService.warn('worker_no_text', { jobId: job.id, msg });
            await Knowledge.findByIdAndUpdate(knowledgeId, {
                processingStatus: 'failed',
                errorReason: msg,
                processingStage: 'failed'
            });
            return;
        }

        // Calculate Hash
        const hash = crypto.createHash('sha256').update(fullText).digest('hex');

        // --- Duplicate Detection ---
        const duplicateDoc = await Knowledge.findOne({
            _id: { $ne: knowledgeId },
            textHash: hash,
            visibility: 'active',
            processingStatus: 'completed'
        });

        if (duplicateDoc) {
            LoggerService.info('worker_duplicate_detected', { jobId: job.id, matchedDoc: duplicateDoc._id });
            await Knowledge.findByIdAndUpdate(knowledgeId, {
                processingStatus: 'failed',
                processingStage: 'failed',
                errorReason: `Duplicate content detected. Identical content already exists in document: "${duplicateDoc.title}"`,
                textHash: hash
            });
            return;
        }

        // 4. Update Content & Hash
        await Knowledge.findByIdAndUpdate(knowledgeId, {
            content: fullText,
            textHash: hash,
            processingStage: 'chunking'
        });

        // 5. Vectorize with Page Metadata
        const ids: string[] = [], embeddings: number[][] = [], metadatas: Record<string, string | number>[] = [], documents: string[] = [];
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
            processingStage: 'completed',
            chunkCount: chunkGlobalIndex
        });
        LoggerService.info('worker_file_job_success', { jobId: job.id, chunkCount: chunkGlobalIndex });

    } catch (err: any) {
        LoggerService.error('worker_file_job_failed', { jobId: job.id, error: err.message });
        try {
            await Knowledge.findByIdAndUpdate(knowledgeId, {
                processingStatus: 'failed',
                processingStage: 'failed',
                errorReason: err.message
            });
        } catch (dbErr: any) {
            LoggerService.error('worker_db_status_sync_failed', { knowledgeId, error: dbErr.message });
        }
        throw err;
    }
};

const streamToBuffer = (stream: NodeJS.ReadableStream): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (err: Error) => reject(err));
    });
};

/**
 * Sanitize error messages before storing them in the database (visible to users).
 * Strips internal IPs, file system paths, and stack traces.
 */
function sanitizeErrorMessage(msg: string): string {
    if (!msg) return 'Unknown processing error';
    // Truncate long messages
    let clean = msg.substring(0, 500);
    // Remove file system paths (Windows and Unix)
    clean = clean.replace(/[A-Z]:\\[\w\\.-]+/gi, '[path]');
    clean = clean.replace(/\/(?:home|usr|var|tmp|etc|opt)\/[\w/.-]+/gi, '[path]');
    // Remove internal IPs
    clean = clean.replace(/\b(127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)\b/g, '[internal-ip]');
    // Remove port numbers after internal references
    clean = clean.replace(/localhost:\d+/gi, '[internal-service]');
    return clean;
}
