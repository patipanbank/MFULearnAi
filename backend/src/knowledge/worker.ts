import { Job } from 'bullmq';
import { Knowledge } from './models';
import { ChromaClient } from 'chromadb';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { minioClient, MINIO_BUCKET } from './minioClient';
import { getEmbedding, getEmbeddingsBatch, chunkText } from './processingUtils';
import crypto from 'crypto';
import dotenv from 'dotenv';
import axios from 'axios';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import chardet from 'chardet';
import { LoggerService } from '../services/LoggerService';
import { CHROMA_URL, GLOBAL_CHROMA_COLLECTION, OCR_SERVICE_URL, GOOGLE_API_KEY } from './constants';
import { detectAndParseStructured, determineQueryStrategy, formatForContextInjection } from './structuredDetector';
import { validateUrlSafety, MAX_URL_RESPONSE_BYTES, MAX_URL_REDIRECTS, URL_FETCH_TIMEOUT_MS } from '../utils/ssrfGuard';
import { redis } from '../config/redis';

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

            const currentDoc = await Knowledge.findByIdAndUpdate(knowledgeId, {
                processingStatus: 'processing',
                processingStage: 'extracting',
                errorReason: ''
            }, { new: true });
            const currentOwnerId = currentDoc?.ownerId;

            LoggerService.debug('worker_fetching_url', { url });

            let markdown = '';

            // --- Google Drive document detection ---
            const googleSheetsMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
            const googleDocsMatch = url.match(/docs\.google\.com\/document\/d\/([\w-]+)/);
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
                    const gvizBase = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
                    let sheetGids: { gid: string; name: string }[] = [];

                    // ── Strategy A: Google Sheets API v4 (reliable, free API key) ──
                    // GET https://sheets.googleapis.com/v4/spreadsheets/{id}?key=KEY&fields=sheets.properties
                    // Returns {sheets:[{properties:{sheetId:0,title:"Tab1"}}, ...]}
                    if (GOOGLE_API_KEY) {
                        try {
                            const apiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${GOOGLE_API_KEY}&fields=sheets.properties(sheetId%2Ctitle)%2Cproperties.title`;
                            const apiRes = await axios.get(apiUrl, { timeout: 10000 });
                            const data = apiRes.data as {
                                properties?: { title?: string };
                                sheets?: Array<{ properties: { sheetId: number; title: string } }>;
                            };
                            if (data.properties?.title) parsedTitle = data.properties.title;
                            if (data.sheets) {
                                sheetGids = data.sheets.map(s => ({
                                    gid: String(s.properties.sheetId),
                                    name: s.properties.title
                                }));
                            }
                            LoggerService.info('worker_google_sheets_api_ok', {
                                jobId: job.id, sheetId, sheetCount: sheetGids.length,
                                sheets: sheetGids.map(s => s.name)
                            });
                        } catch (apiErr: any) {
                            LoggerService.warn('worker_google_sheets_api_failed', {
                                jobId: job.id, reason: apiErr.message,
                                hint: 'Check GOOGLE_API_KEY env var and ensure Google Sheets API is enabled'
                            });
                        }
                    }

                    // ── Strategy B: Parse edit page HTML (works if Google returns HTML) ──
                    if (sheetGids.length === 0) {
                        try {
                            const editPageRes = await axios.get(url, {
                                ...safeAxiosDefaults,
                                timeout: 15000,
                                validateStatus: (s) => s < 500 // Accept 4xx to inspect body
                            });
                            if (editPageRes.status === 200) {
                                const htmlBody: string = editPageRes.data as string;
                                const sheetIdRegex = /"sheetId":(\d+),"title":"([^"]+)"/g;
                                let m: RegExpExecArray | null;
                                while ((m = sheetIdRegex.exec(htmlBody)) !== null) {
                                    sheetGids.push({ gid: m[1], name: m[2] });
                                }
                                if (sheetGids.length === 0) {
                                    const $ = cheerio.load(htmlBody);
                                    $('ul.sheet-tab-container li, [id^="sheet-button-"]').each((_: any, el: any) => {
                                        const gid = $(el).attr('id')?.replace(/\D/g, '') || '';
                                        const name = $(el).text().trim();
                                        if (gid && name) sheetGids.push({ gid, name });
                                    });
                                }
                            }
                        } catch (_) { /* edit page not accessible — expected for server-side */ }
                    }

                    // ── Strategy C: pubhtml page (works if sheet is "Published to web") ──
                    if (sheetGids.length === 0) {
                        try {
                            const pubUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/pubhtml`;
                            const pubRes = await axios.get(pubUrl, { ...safeAxiosDefaults, timeout: 10000 });
                            if (pubRes.status === 200) {
                                const $pub = cheerio.load(pubRes.data as string);
                                $pub('[data-sheet-id]').each((_: any, el: any) => {
                                    const gid = $pub(el).attr('data-sheet-id') || '';
                                    const name = $pub(el).text().trim();
                                    if (gid && name) sheetGids.push({ gid, name });
                                });
                                const pageTitle = $pub('title').text().trim();
                                if (pageTitle) parsedTitle = pageTitle.replace(/\s*-\s*Google Sheets.*$/i, '').trim();
                            }
                        } catch (_) { /* pubhtml not available */ }
                    }

                    // Deduplicate by gid
                    const seen = new Set<string>();
                    sheetGids = sheetGids.filter(s => {
                        if (seen.has(s.gid)) return false;
                        seen.add(s.gid);
                        return true;
                    });

                    if (sheetGids.length === 0) {
                        LoggerService.warn('worker_google_sheets_enum_failed', {
                            jobId: job.id,
                            reason: GOOGLE_API_KEY ? 'API + HTML fallbacks all failed' : 'No GOOGLE_API_KEY configured — set env var for multi-sheet support'
                        });
                    }

                    // ── Fetch each sheet's data via gviz/tq ──
                    if (sheetGids.length > 1) {
                        LoggerService.info('worker_google_sheets_multi', {
                            jobId: job.id, sheetCount: sheetGids.length,
                            sheets: sheetGids.map(s => s.name)
                        });
                        for (const sheet of sheetGids) {
                            try {
                                const sheetCsvRes = await axios.get(`${gvizBase}&gid=${sheet.gid}`, {
                                    ...safeAxiosDefaults,
                                    timeout: 20000
                                });
                                const sheetCsv: string = sheetCsvRes.data as string;
                                if (sheetCsv.trim()) markdown += `\n--- Sheet: ${sheet.name} ---\n${sheetCsv.trim()}\n`;
                            } catch (sheetErr: any) {
                                LoggerService.warn('worker_google_sheets_gviz_sheet_fail', {
                                    jobId: job.id, sheet: sheet.name, gid: sheet.gid, reason: sheetErr.message
                                });
                            }
                        }
                        markdown = markdown.trim();
                    } else {
                        // Single sheet or enumeration failed — fetch default
                        const csvRes = await axios.get(gvizBase, safeAxiosDefaults);
                        const csvText: string = csvRes.data as string;
                        if (!csvText.trim()) throw new Error('Google Sheets returned empty content — check the sheet has data and sharing is set to "Anyone with the link".');
                        markdown = `--- Sheet: ${sheetGids[0]?.name || 'Sheet1'} ---\n${csvText.trim()}`;
                    }

                    LoggerService.info('worker_google_sheets_gviz_ok', {
                        jobId: job.id, sheetId,
                        sheetCount: sheetGids.length || 1,
                        enumMethod: GOOGLE_API_KEY ? 'sheets-api-v4' : 'html-fallback'
                    });
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

            // ── Freshness Gate: skip re-vectorization if content unchanged ──
            const existingKb = await Knowledge.findById(knowledgeId).select('textHash processingStatus').lean();
            if (existingKb?.textHash === hash && existingKb?.processingStatus === 'completed') {
                LoggerService.info('worker_freshness_skip', { jobId: job.id, knowledgeId, reason: 'hash_unchanged' });
                return; // Content unchanged — vectors are already correct
            }

            // --- Duplicate Detection (per-owner: different users may upload same content) ---
            const duplicateDoc = await Knowledge.findOne({
                _id: { $ne: knowledgeId },
                ownerId: currentOwnerId,
                textHash: hash,
                visibility: 'active',
                processingStatus: 'completed'
            });

            if (duplicateDoc) {
                LoggerService.info('worker_duplicate_detected', { jobId: job.id, matchedDoc: duplicateDoc._id, ownerId: currentOwnerId });
                await Knowledge.findByIdAndUpdate(knowledgeId, {
                    processingStatus: 'failed',
                    processingStage: 'failed',
                    errorReason: `Duplicate content detected. Identical content already exists in document: "${duplicateDoc.title}"`,
                    s3Size: buffer.length,
                    textHash: hash
                });
                return;
            }

            // ── Structured Data Detection (dual-path) ──
            const structuredResult = detectAndParseStructured(markdown);
            const queryStrategy = structuredResult.isStructured
                ? determineQueryStrategy(structuredResult.meta)
                : null;

            LoggerService.info('worker_structure_detection', {
                jobId: job.id, knowledgeId,
                format: structuredResult.format,
                confidence: structuredResult.confidence,
                rowCount: structuredResult.meta.rowCount,
                colCount: structuredResult.meta.colCount,
                queryStrategy: queryStrategy || 'vector_only'
            });

            // Update Content + structured data
            const updateData: any = {
                content: markdown,
                textHash: hash,
                processingStage: 'chunking',
                s3Size: buffer.length,
                dataFormat: structuredResult.format
            };

            if (structuredResult.isStructured && structuredResult.rows.length > 0) {
                updateData.structuredData = structuredResult.rows;
                updateData.structuredMeta = structuredResult.meta;
            }

            const knowledgeDoc = await Knowledge.findByIdAndUpdate(knowledgeId, updateData);

            const docType = knowledgeDoc?.type || 'personal';

            // 5. Vectorize directly (concurrent batch embedding)
            const pages = [{ text: markdown, pageNumber: 1 }];
            const allChunks: { text: string; pageNumber: number }[] = [];
            for (const p of pages) {
                const pageChunks = await chunkText(p.text);
                pageChunks.forEach(chunk => allChunks.push({ text: chunk, pageNumber: p.pageNumber }));
            }

            LoggerService.info('worker_url_embedding_start', {
                jobId: job.id, knowledgeId, chunkCount: allChunks.length
            });
            await Knowledge.findByIdAndUpdate(knowledgeId, { processingStage: 'embedding' });

            const chunkTexts = allChunks.map(c => c.text);
            const allEmbeddings = await getEmbeddingsBatch(chunkTexts, (done, total) => {
                if (done % 10 === 0 || done === total) {
                    LoggerService.info('worker_url_embedding_progress', {
                        jobId: job.id, knowledgeId, done, total,
                        pct: Math.round((done / total) * 100)
                    });
                }
            });

            const ids: string[] = [], embeddings: number[][] = [], metadatas: Record<string, string | number>[] = [], documents: string[] = [];
            allChunks.forEach((chunk, idx) => {
                ids.push(`${knowledgeId}-${idx}`);
                embeddings.push(allEmbeddings[idx]);
                documents.push(chunk.text);
                metadatas.push({
                    knowledgeId: knowledgeId.toString(),
                    source: url,
                    type: docType,
                    fileName: url,
                    pageNumber: chunk.pageNumber,
                    chunkIndex: idx
                });
            });

            await Knowledge.findByIdAndUpdate(knowledgeId, { processingStage: 'indexing' });

            const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION, embeddingFunction: null as any });
            await col.add({ ids, embeddings, metadatas, documents });

            // 6. Complete
            await Knowledge.findByIdAndUpdate(knowledgeId, {
                processingStatus: 'completed',
                processingStage: 'completed',
                chunkCount: allChunks.length
            });
            LoggerService.info('worker_url_job_success', { jobId: job.id, chunkCount: allChunks.length });
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

                const response = await requestOcrFromBucket(s3Key, job.id?.toString() || 'unknown', knowledgeId);

                fullText = response.data.text;
                const parsedPages = fullText.split('--- Page ').slice(1).map(p => {
                    const [num, ...rest] = p.split(' ---');
                    return { pageNumber: parseInt(num), text: rest.join(' ---') };
                });
                pages = parsedPages.length > 0 ? parsedPages : [{ text: fullText, pageNumber: 1 }];
            }

        } else if (mimetype === 'image/png' || mimetype === 'image/jpeg' || mimetype === 'image/tiff') {
            LoggerService.info('worker_image_ocr', { jobId: job.id });
            const response = await requestOcrFromBucket(s3Key, job.id?.toString() || 'unknown', knowledgeId);
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

        // ── Freshness Gate: skip re-vectorization if content unchanged ──
        const existingFileKb = await Knowledge.findById(knowledgeId).select('textHash processingStatus').lean();
        if (existingFileKb?.textHash === hash && existingFileKb?.processingStatus === 'completed') {
            LoggerService.info('worker_freshness_skip', { jobId: job.id, knowledgeId, reason: 'hash_unchanged' });
            return; // Content unchanged — vectors are already correct
        }

        // --- Duplicate Detection (per-owner: different users may upload same content) ---
        const fileOwnerId = knowledgeDoc?.ownerId;
        const duplicateDoc = await Knowledge.findOne({
            _id: { $ne: knowledgeId },
            ownerId: fileOwnerId,
            textHash: hash,
            visibility: 'active',
            processingStatus: 'completed'
        });

        if (duplicateDoc) {
            LoggerService.info('worker_duplicate_detected', { jobId: job.id, matchedDoc: duplicateDoc._id, ownerId: fileOwnerId });
            await Knowledge.findByIdAndUpdate(knowledgeId, {
                processingStatus: 'failed',
                processingStage: 'failed',
                errorReason: `Duplicate content detected. Identical content already exists in document: "${duplicateDoc.title}"`,
                textHash: hash
            });
            return;
        }

        // ── Structured Data Detection (dual-path) ── for file uploads
        const structuredResultFile = detectAndParseStructured(fullText);
        const fileQueryStrategy = structuredResultFile.isStructured
            ? determineQueryStrategy(structuredResultFile.meta)
            : null;

        LoggerService.info('worker_file_structure_detection', {
            jobId: job.id, knowledgeId,
            format: structuredResultFile.format,
            confidence: structuredResultFile.confidence,
            rowCount: structuredResultFile.meta.rowCount,
            colCount: structuredResultFile.meta.colCount,
            queryStrategy: fileQueryStrategy || 'vector_only'
        });

        // 4. Update Content, Hash & Structured Data
        const fileUpdateData: any = {
            content: fullText,
            textHash: hash,
            processingStage: 'chunking',
            dataFormat: structuredResultFile.format
        };

        if (structuredResultFile.isStructured && structuredResultFile.rows.length > 0) {
            fileUpdateData.structuredData = structuredResultFile.rows;
            fileUpdateData.structuredMeta = structuredResultFile.meta;
        }

        await Knowledge.findByIdAndUpdate(knowledgeId, fileUpdateData);

        // 5. Vectorize with Page Metadata (concurrent batch embedding)
        const allChunks: { text: string; pageNumber: number }[] = [];
        for (const p of pages) {
            const pageChunks = await chunkText(p.text);
            pageChunks.forEach(chunk => allChunks.push({ text: chunk, pageNumber: p.pageNumber }));
        }

        LoggerService.info('worker_file_embedding_start', {
            jobId: job.id, knowledgeId, chunkCount: allChunks.length
        });
        await Knowledge.findByIdAndUpdate(knowledgeId, { processingStage: 'embedding' });

        const chunkTexts = allChunks.map(c => c.text);
        const allEmbeddings = await getEmbeddingsBatch(chunkTexts, (done, total) => {
            if (done % 10 === 0 || done === total) {
                LoggerService.info('worker_file_embedding_progress', {
                    jobId: job.id, knowledgeId, done, total,
                    pct: Math.round((done / total) * 100)
                });
            }
        });

        const ids: string[] = [], embeddings: number[][] = [], metadatas: Record<string, string | number>[] = [], documents: string[] = [];
        allChunks.forEach((chunk, idx) => {
            ids.push(`${knowledgeId}-${idx}`);
            embeddings.push(allEmbeddings[idx]);
            documents.push(chunk.text);
            metadatas.push({
                knowledgeId: knowledgeId.toString(),
                source: originalName,
                type: docType,           // Critical: enables PolicyCheckerTool { type: 'policy' } filter
                fileName: originalName,   // Alias for consistent metadata access
                pageNumber: chunk.pageNumber,
                chunkIndex: idx
            });
        });

        await Knowledge.findByIdAndUpdate(knowledgeId, { processingStage: 'indexing' });

        const col = await chroma.getCollection({ name: GLOBAL_CHROMA_COLLECTION, embeddingFunction: null as any });
        await col.add({ ids, embeddings, metadatas, documents });

        // 6. Complete
        await Knowledge.findByIdAndUpdate(knowledgeId, {
            processingStatus: 'completed',
            processingStage: 'completed',
            chunkCount: allChunks.length
        });
        LoggerService.info('worker_file_job_success', { jobId: job.id, chunkCount: allChunks.length });

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

async function requestOcrFromBucket(s3Key: string, jobId: string, knowledgeId: string) {
    const subscriber = redis.duplicate();
    const channel = `ocr:progress:${knowledgeId}`;
    let isSubscribed = false;

    try {
        await subscriber.subscribe(channel);
        isSubscribed = true;

        subscriber.on('message', async (ch, message) => {
            if (ch === channel) {
                try {
                    const data = JSON.parse(message);
                    const msg = `Page ${data.page} of ${data.totalPages}`;
                    await Knowledge.findByIdAndUpdate(knowledgeId, { processingMessage: msg });
                } catch (e) { /* ignore parse errors */ }
            }
        });

        return await axios.post(
            `${OCR_SERVICE_URL}/ocr-bucket`,
            {
                bucket: MINIO_BUCKET,
                key: s3Key,
                knowledge_id: knowledgeId
            },
            {
                timeout: 180000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            }
        );
    } catch (err: any) {
        if (axios.isAxiosError(err)) {
            const status = err.response?.status;
            const detailRaw = err.response?.data?.detail || err.response?.data?.error || err.message;
            const detail = String(detailRaw || 'Unknown OCR error').substring(0, 500);

            LoggerService.error('worker_ocr_request_failed', {
                jobId,
                s3Key,
                status,
                detail
            });

            throw new Error(`OCR service error${status ? ` (${status})` : ''}: ${detail}`);
        }

        throw err;
    } finally {
        if (isSubscribed) {
            subscriber.unsubscribe(channel).catch(() => { });
        }
        subscriber.quit().catch(() => { });
    }
}

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
