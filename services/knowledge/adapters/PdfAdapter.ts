import { BaseAdapter } from './BaseAdapter';
import { CanonicalIR, IRBlock, Warning } from '../../../shared/types';
import axios from 'axios';
import FormData from 'form-data';

interface PdfAdapterConfig {
    minAvgLineLength: number;
    maxNonPrintableRatio: number;
    ocrServiceUrl: string;
}

const CONFIG: PdfAdapterConfig = {
    minAvgLineLength: 5,
    maxNonPrintableRatio: 0.2, // 20% garbage chars is suspicious
    ocrServiceUrl: process.env.OCR_SERVICE_URL || 'http://ocr-service:5000'
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
                console.log('[PdfAdapter] Text layer detected as garbage. Falling back to OCR.');
                return await this.performOcr(buffer, originalName, 'GARBAGE_TEXT_LAYER');
            }

            // 3. Validate Quantity (Scanned Detection)
            if (this.isScanned(result)) {
                console.log('[PdfAdapter] Low text density (Scanned). Falling back to OCR.');
                return await this.performOcr(buffer, originalName, 'SCANNED_PDF');
            }

            // Quality is Good
            return this.convertToIR(result, buffer.length); // Calculate real metadata

        } catch (e) {
            console.error('[PdfAdapter] Native parse failed:', e);
            // Fallback to OCR on error?
            return await this.performOcr(buffer, originalName, 'PARTIAL_PARSE');
        }
    }

    private async extractNativeText(buffer: Buffer): Promise<{ pages: { text: string, pageNum: number }[] }> {
        // Dynamic Import for PDF.js (Legacy build for Node)
        const importDynamic = new Function('modulePath', 'return import(modulePath)');
        const pdfjs = await importDynamic('pdfjs-dist/legacy/build/pdf.mjs');

        const loadingTask = pdfjs.getDocument({
            data: new Uint8Array(buffer),
            useSystemFonts: true,
            disableFontFace: true,
            verbosity: 0
        });

        const doc = await loadingTask.promise;
        const pages = [];

        for (let i = 1; i <= doc.numPages; i++) {
            const page = await doc.getPage(i);
            const content = await page.getTextContent();
            // Simple sort by geometry could go here if needed, but pdfjs usually returns in reading order roughly
            // For now, joining items with space. 
            // Better: Check 'transform' via logic, but simple join is usually "okay" for flat text.
            const text = content.items.map((item: any) => item.str).join(' ');
            pages.push({ text, pageNum: i });
        }
        return { pages };
    }

    private isGarbageText(result: { pages: { text: string }[] }): boolean {
        const fullText = result.pages.map(p => p.text).join(' ');
        if (fullText.length < 100) return false; // Too short to judge encoding, likely scanned logic handles it

        // Heuristic A: Non-printable characters
        // Removing common whitespace/punctuation
        const printable = fullText.replace(/[^\x20-\x7E\s\u0E00-\u0E7F]/g, ''); // ASCII + Thai
        const garbageRatio = 1 - (printable.length / fullText.length);

        if (garbageRatio > CONFIG.maxNonPrintableRatio) return true;

        // Heuristic B: Avg Line Length (Pseudo-lines based on spacing?)
        // Hard to do without strict layout. 
        // Instead check avg token length? 
        // If "t o k e n s a r e l i k e t h i s", avg length is 1.
        const words = fullText.split(/\s+/);
        const avgWordLen = words.reduce((acc, w) => acc + w.length, 0) / (words.length || 1);
        if (avgWordLen < 1.5) return true; // Suspiciously broken text

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

            const res = await axios.post(`${CONFIG.ocrServiceUrl}/ocr`, formData, {
                headers: formData.getHeaders(),
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            });

            // OCR Service returns: { text: "...", pages: 1 } (It concatenates pages with delimiters usually)
            // Existing service uses "--- Page X ---"
            const fullText = res.data.text || '';

            // Split back into pages
            const pageParts = fullText.split(/--- Page \d+ ---/g).filter((t: string) => t.trim().length > 0);

            const blocks: IRBlock[] = pageParts.map((text: string, idx: number) => ({
                type: 'text',
                content: text.trim(),
                metadata: {
                    page: idx + 1,
                    confidence: 0.7, // Assume OCR is lower confidence
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

        } catch (e) {
            console.error('[PdfAdapter] OCR failed:', e);
            throw new Error('OCR processing failed');
        }
    }

    private convertToIR(result: { pages: { text: string, pageNum: number }[] }, totalSize: number): CanonicalIR {
        // Header/Footer Deduplication Logic could go here
        // For now, mapping directly
        const blocks: IRBlock[] = result.pages.map(p => ({
            type: 'text',
            content: p.text,
            metadata: {
                page: p.pageNum,
                confidence: 0.95,
                source: 'text_layer'
            }
        }));

        return {
            file_type: 'document',
            blocks,
            metadata: {
                total_tokens: totalSize / 4 // Crude
            }
        };
    }
}
