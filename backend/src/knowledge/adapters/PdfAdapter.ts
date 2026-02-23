import { BaseAdapter } from './BaseAdapter';
import { CanonicalIR, IRBlock, Warning } from '../../../../shared/types';
import axios from 'axios';
import FormData from 'form-data';
import { LoggerService } from '../../services/LoggerService';
import { OCR_SERVICE_URL } from '../constants';

interface PdfAdapterConfig {
    minAvgLineLength: number;
    maxNonPrintableRatio: number;
}

const CONFIG: PdfAdapterConfig = {
    minAvgLineLength: 5,
    maxNonPrintableRatio: 0.2, // 20% garbage chars is suspicious
};

export class PdfAdapter implements BaseAdapter {
    canHandle(mimeType: string, extension: string, buffer: Buffer): boolean {
        return mimeType === 'application/pdf' || extension === 'pdf';
    }

    async parse(buffer: Buffer, originalName: string): Promise<CanonicalIR> {
        // 1. Try Native Text Extraction
        try {
            const result = await this.extractNativeText(buffer);

            // 2. Validate Quality (Garbage Detection)
            if (this.isGarbageText(result)) {
                LoggerService.info('pdf_adapter_garbage_detected', { file: originalName });
                return await this.performOcr(buffer, originalName, 'GARBAGE_TEXT_LAYER');
            }

            // 3. Validate Quantity (Scanned Detection)
            if (this.isScanned(result)) {
                LoggerService.info('pdf_adapter_scanned_detected', { file: originalName });
                return await this.performOcr(buffer, originalName, 'SCANNED_PDF');
            }

            // Quality is Good
            return this.convertToIR(result, buffer.length);

        } catch (e: any) {
            LoggerService.error('pdf_adapter_native_parse_failed', { file: originalName, error: e.message });
            // Fallback to OCR on error
            return await this.performOcr(buffer, originalName, 'PARTIAL_PARSE');
        }
    }

    private async extractNativeText(buffer: Buffer): Promise<{ pages: { text: string, pageNum: number }[] }> {
        // Standard dynamic import for PDF.js (no new Function hack — CQ-10)
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

        const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(buffer),
            useSystemFonts: true,
            disableFontFace: true,
            verbosity: 0 // Suppress PDF.js warnings at library level
        });

        const doc = await loadingTask.promise;
        const pages = [];

        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            const text = content.items.map((item: any) => item.str).join(' ');
            pages.push({ text, pageNum: i });
        }
        return { pages };
    }

    private isGarbageText(result: { pages: { text: string }[] }): boolean {
        const fullText = result.pages.map(p => p.text).join(' ');
        if (fullText.length < 100) return false; // Too short to judge encoding

        // Heuristic A: Non-printable characters (ASCII + Thai range)
        const printable = fullText.replace(/[^\x20-\x7E\s\u0E00-\u0E7F]/g, '');
        const garbageRatio = 1 - (printable.length / fullText.length);

        if (garbageRatio > CONFIG.maxNonPrintableRatio) return true;

        // Heuristic B: Average word length (broken text like "t o k e n s" has avg ~1)
        const words = fullText.split(/\s+/);
        const avgWordLen = words.reduce((acc, w) => acc + w.length, 0) / (words.length || 1);
        if (avgWordLen < 1.5) return true;

        return false;
    }

    private isScanned(result: { pages: { text: string }[] }): boolean {
        // If > 50% of pages have < 50 chars, assume scanned
        const emptyPages = result.pages.filter(p => p.text.trim().length < 50).length;
        return (emptyPages / result.pages.length) > 0.5;
    }

    private async performOcr(buffer: Buffer, filename: string, reasonCode: Warning['code']): Promise<CanonicalIR> {
        try {
            const formData = new FormData();
            formData.append('file', buffer, { filename });

            const res = await axios.post(`${OCR_SERVICE_URL}/ocr`, formData, {
                headers: formData.getHeaders(),
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });

            const fullText = res.data.text || '';

            // Split back into pages
            const pageParts = fullText.split(/--- Page \d+ ---/g).filter((t: string) => t.trim().length > 0);

            const blocks: IRBlock[] = pageParts.map((text: string, idx: number) => ({
                id: `ocr_b${idx}`,
                type: 'text',
                content: text.trim(),
                metadata: {
                    page: idx + 1,
                    confidence: 0.7, // OCR is lower confidence
                    source: 'ocr'
                }
            }));

            return {
                file_type: 'document',
                blocks,
                metadata: {
                    warnings: [{ code: reasonCode, message: 'Document required OCR processing.' }],
                    detected_language: 'unknown'
                }
            };

        } catch (e: any) {
            LoggerService.error('pdf_adapter_ocr_failed', { file: filename, error: e.message });
            throw new Error('OCR processing failed');
        }
    }

    private convertToIR(result: { pages: { text: string, pageNum: number }[] }, totalSize: number): CanonicalIR {
        const blocks: IRBlock[] = result.pages.map((p, idx) => ({
            id: `pdf_b${idx}`,
            type: 'text',
            content: p.text,
            metadata: {
                page: p.pageNum,
                confidence: 0.95,
                source: 'text_layer'
            }
        }));

        // CQ-14: Improved token estimation (rough but better than bytes/4)
        const fullText = result.pages.map(p => p.text).join(' ');
        const wordCount = fullText.split(/\s+/).filter(w => w.length > 0).length;
        const estimatedTokens = Math.ceil(wordCount * 1.3); // ~1.3 tokens per word (accounts for subwords)

        return {
            file_type: 'document',
            blocks,
            metadata: {
                total_tokens: estimatedTokens
            }
        };
    }
}
