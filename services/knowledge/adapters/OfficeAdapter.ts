import { BaseAdapter } from './BaseAdapter';
import { CanonicalIR, IRBlock } from '../shared/types';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export class OfficeAdapter implements BaseAdapter {
    canHandle(mimeType: string, extension: string, buffer: Buffer): boolean {
        return [
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/msword' // Old doc, might not work well with mammoth but we can try or skip
        ].includes(mimeType) || ['docx', 'xlsx', 'xls', 'csv'].includes(extension);
    }

    async parse(buffer: Buffer, originalName: string): Promise<CanonicalIR> {
        const ext = originalName.split('.').pop()?.toLowerCase();

        if (ext === 'docx') {
            return this.parseDocx(buffer, originalName);
        } else if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
            return this.parseExcel(buffer, originalName);
        }

        throw new Error(`Unsupported office file: ${originalName}`);
    }

    private async parseDocx(buffer: Buffer, filename: string): Promise<CanonicalIR> {
        const result = await mammoth.extractRawText({ buffer });
        const text = result.value;
        const messages = result.messages; // Warnings from mammoth

        // Mammoth gives flat text. 
        // Improvement: Use `convertToHtml` key and parse HTML for structure? 
        // For now, sticking to raw text but blocks based on double newlines.
        const paragraphs = text.split(/\n\s*\n/);

        const blocks: IRBlock[] = paragraphs.filter(p => p.trim()).map(p => ({
            type: 'text',
            content: p.trim(),
            metadata: {
                title: filename,
                confidence: 1.0,
                source: 'text_layer'
            }
        }));

        return {
            file_type: 'document',
            blocks,
            metadata: {
                detected_language: 'unknown',
                warnings: messages.map(m => ({ code: 'PARTIAL_PARSE', message: m.message })) as any
            }
        };
    }

    private async parseExcel(buffer: Buffer, filename: string): Promise<CanonicalIR> {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const blocks: IRBlock[] = [];

        workbook.SheetNames.forEach(sheetName => {
            const sheet = workbook.Sheets[sheetName];

            // Convert to JSON with Header support
            // logic: header: 1 returns array of arrays
            const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

            if (rows.length === 0) return;

            // Handle Merged Cells: Duplicate values to covered cells
            if (sheet['!merges']) {
                sheet['!merges'].forEach(range => {
                    const startRow = range.s.r;
                    const startCol = range.s.c;
                    const val = rows[startRow]?.[startCol]; // Validation needed

                    for (let r = range.s.r; r <= range.e.r; r++) {
                        for (let c = range.s.c; c <= range.e.c; c++) {
                            if (!rows[r]) rows[r] = [];
                            rows[r][c] = val; // Duplicate value
                        }
                    }
                });
            }

            // Create Table Block
            // Limit size? If huge, chunk it?
            // For now, 1 sheet = 1 block (risk of token overflow, but "Transient Context" usually handles ~100k)

            // Format content as Text Table for LLM Prompt
            const textRep = rows.map(row => row.join(' | ')).join('\n');

            blocks.push({
                type: 'table',
                content: `Sheet: ${sheetName}\n${textRep}`,
                table_data: {
                    headers: rows[0].map(c => String(c)),
                    rows: rows.slice(1).map(r => r.map(c => String(c)))
                },
                metadata: {
                    sheet: sheetName,
                    confidence: 1.0,
                    source: 'text_layer'
                }
            });
        });

        return {
            file_type: 'sheet',
            blocks,
            metadata: {
                layout: 'unknown'
            }
        };
    }
}
