/**
 * Structured Data Detector & Parser
 * 
 * Auto-detects whether content is structured (tabular) vs unstructured (prose),
 * and parses structured data into queryable JSON.
 * 
 * Detection heuristic:
 *   1. Consistent column count across rows (>80%)
 *   2. Has header row (first row differs from data pattern)
 *   3. Average cell length < 100 chars (tabular, not prose)
 *   4. At least 3 rows and 2 columns
 * 
 * Supports multi-sheet format: "--- Sheet: Name ---\n<CSV>"
 */

import { LoggerService } from '../services/LoggerService';

export interface StructuredDetectionResult {
    isStructured: boolean;
    confidence: number;        // 0-1
    format: 'structured' | 'unstructured' | 'hybrid';
    sheets: ParsedSheet[];
    meta: {
        headers: string[];
        rowCount: number;
        colCount: number;
        totalChars: number;
        sheetNames: string[];
        keyColumns: string[];
    };
    rows: Array<Record<string, string>>; // Flat array of all rows across sheets
}

export interface ParsedSheet {
    name: string;
    headers: string[];
    rows: Array<Record<string, string>>;
    rawCsv: string;
}

// ── Detection thresholds (tuned via constants) ──
const MIN_ROWS = 3;
const MIN_COLS = 2;
const MAX_AVG_CELL_CHARS = 100;       // Above this → "prose in cells" → hybrid
const COLUMN_CONSISTENCY_THRESHOLD = 0.75; // 75% of rows must match header col count
const HYBRID_AVG_CELL_CHARS = 200;    // Above this → unstructured

/**
 * Detect if content is structured data and parse it.
 * Input: raw markdown/text content (may contain "--- Sheet: Name ---" delimiters)
 */
export function detectAndParseStructured(content: string): StructuredDetectionResult {
    const sheets = splitIntoSheets(content);

    if (sheets.length === 0) {
        return makeUnstructured(content);
    }

    let totalStructuredSheets = 0;
    let totalHybridSheets = 0;
    const allRows: Array<Record<string, string>> = [];
    const allHeaders = new Set<string>();
    let totalChars = 0;
    let totalRowCount = 0;
    const sheetNames: string[] = [];
    const parsedSheets: ParsedSheet[] = [];

    for (const sheet of sheets) {
        const analysis = analyzeSheet(sheet.csv);
        sheetNames.push(sheet.name);

        if (analysis.isStructured) {
            totalStructuredSheets++;
            const parsed = parseCsvToRows(sheet.csv, sheet.name);
            parsedSheets.push(parsed);
            allRows.push(...parsed.rows);
            parsed.headers.forEach(h => allHeaders.add(h));
            totalChars += analysis.totalChars;
            totalRowCount += parsed.rows.length;
        } else if (analysis.isHybrid) {
            totalHybridSheets++;
            const parsed = parseCsvToRows(sheet.csv, sheet.name);
            parsedSheets.push(parsed);
            allRows.push(...parsed.rows);
            parsed.headers.forEach(h => allHeaders.add(h));
            totalChars += analysis.totalChars;
            totalRowCount += parsed.rows.length;
        } else {
            // Unstructured sheet — skip structured parsing
            parsedSheets.push({
                name: sheet.name,
                headers: [],
                rows: [],
                rawCsv: sheet.csv
            });
        }
    }

    const headersArray = Array.from(allHeaders);
    const colCount = headersArray.length;

    // Determine overall format
    let format: 'structured' | 'unstructured' | 'hybrid';
    let isStructured: boolean;
    let confidence: number;

    if (totalStructuredSheets === sheets.length) {
        format = 'structured';
        isStructured = true;
        confidence = 0.95;
    } else if (totalStructuredSheets + totalHybridSheets > 0) {
        format = 'hybrid';
        isStructured = true;
        confidence = 0.7;
    } else {
        return makeUnstructured(content);
    }

    // Detect key columns (low cardinality or unique identifiers)
    const keyColumns = detectKeyColumns(allRows, headersArray);

    const meta = {
        headers: headersArray,
        rowCount: totalRowCount,
        colCount,
        totalChars,
        sheetNames,
        keyColumns
    };

    LoggerService.debug('structured_detection_result', { format, confidence, rowCount: totalRowCount, colCount, sheetCount: sheets.length });

    return { isStructured, confidence, format, sheets: parsedSheets, meta, rows: allRows };
}

/**
 * Analyze a single CSV block for structure characteristics.
 */
function analyzeSheet(csv: string): { isStructured: boolean; isHybrid: boolean; totalChars: number } {
    const lines = csv.split('\n').filter(l => l.trim());
    if (lines.length < MIN_ROWS) {
        return { isStructured: false, isHybrid: false, totalChars: 0 };
    }

    const rowColCounts = lines.map(l => parseCSVLine(l).length);
    const headerCols = rowColCounts[0];

    if (headerCols < MIN_COLS) {
        return { isStructured: false, isHybrid: false, totalChars: 0 };
    }

    // Column consistency check
    const consistentRows = rowColCounts.filter(c => c === headerCols).length;
    const consistency = consistentRows / lines.length;

    if (consistency < COLUMN_CONSISTENCY_THRESHOLD) {
        return { isStructured: false, isHybrid: false, totalChars: 0 };
    }

    // Average cell length
    let totalChars = 0;
    let cellCount = 0;
    for (const line of lines) {
        const cells = parseCSVLine(line);
        for (const cell of cells) {
            totalChars += cell.length;
            cellCount++;
        }
    }
    const avgCellLen = cellCount > 0 ? totalChars / cellCount : 0;

    if (avgCellLen > HYBRID_AVG_CELL_CHARS) {
        return { isStructured: false, isHybrid: false, totalChars };
    }
    if (avgCellLen > MAX_AVG_CELL_CHARS) {
        return { isStructured: false, isHybrid: true, totalChars };
    }

    return { isStructured: true, isHybrid: false, totalChars };
}

/**
 * Parse CSV text into header + row objects.
 */
function parseCsvToRows(csv: string, sheetName: string): ParsedSheet {
    const lines = csv.split('\n').filter(l => l.trim());
    if (lines.length < 2) {
        return { name: sheetName, headers: [], rows: [], rawCsv: csv };
    }

    const headers = parseCSVLine(lines[0]).map(h => h.trim());
    const rows: Array<Record<string, string>> = [];

    for (let i = 1; i < lines.length; i++) {
        const cells = parseCSVLine(lines[i]);
        const row: Record<string, string> = { _sheet: sheetName };
        for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = (cells[j] || '').trim();
        }
        // Skip completely empty rows
        const hasData = headers.some(h => row[h] && row[h].length > 0);
        if (hasData) rows.push(row);
    }

    return { name: sheetName, headers, rows, rawCsv: csv };
}

/**
 * Split multi-sheet content into individual sheets.
 * Format: "--- Sheet: Name ---\n<CSV data>"
 */
function splitIntoSheets(content: string): Array<{ name: string; csv: string }> {
    const sheetDelimiter = /^---\s*Sheet:\s*(.+?)\s*---$/gm;
    const sheets: Array<{ name: string; csv: string }> = [];

    let match: RegExpExecArray | null;
    const positions: Array<{ name: string; start: number }> = [];

    while ((match = sheetDelimiter.exec(content)) !== null) {
        positions.push({ name: match[1], start: match.index + match[0].length });
    }

    if (positions.length === 0) {
        // No sheet delimiters — treat entire content as single sheet
        const trimmed = content.trim();
        if (trimmed) {
            sheets.push({ name: 'Sheet1', csv: trimmed });
        }
        return sheets;
    }

    for (let i = 0; i < positions.length; i++) {
        const start = positions[i].start;
        const end = i + 1 < positions.length
            ? content.lastIndexOf('---', positions[i + 1].start)
            : content.length;
        const csv = content.substring(start, end).trim();
        if (csv) {
            sheets.push({ name: positions[i].name, csv });
        }
    }

    return sheets;
}

/**
 * Detect columns that serve as good lookup keys:
 *   - Unique or near-unique values (>90% unique) → ID/key column
 *   - Low cardinality (<20 distinct values) → category/filter column
 */
function detectKeyColumns(rows: Array<Record<string, string>>, headers: string[]): string[] {
    if (rows.length === 0) return [];

    const keyColumns: string[] = [];

    for (const header of headers) {
        if (header === '_sheet') continue;
        const values = rows.map(r => r[header]).filter(v => v && v.length > 0);
        if (values.length === 0) continue;

        const unique = new Set(values);
        const uniqueRatio = unique.size / values.length;

        // Near-unique → good primary key
        if (uniqueRatio > 0.9 && values.length >= 3) {
            keyColumns.push(header);
        }
        // Low cardinality → good filter/category
        else if (unique.size <= 20 && unique.size >= 2 && values.length >= 5) {
            keyColumns.push(header);
        }
    }

    return keyColumns;
}

/**
 * RFC 4180 CSV line parser.
 * Handles quoted fields with commas and escaped quotes.
 */
function parseCSVLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++; // skip escaped quote
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                cells.push(current);
                current = '';
            } else {
                current += ch;
            }
        }
    }
    cells.push(current);
    return cells;
}

function makeUnstructured(content: string): StructuredDetectionResult {
    return {
        isStructured: false,
        confidence: 0,
        format: 'unstructured',
        sheets: [],
        meta: { headers: [], rowCount: 0, colCount: 0, totalChars: content.length, sheetNames: [], keyColumns: [] },
        rows: []
    };
}

/**
 * Determine the query strategy based on structured data size.
 * 
 * Thresholds (based on user feedback):
 *   - cells ≤ 8000 OR totalChars ≤ 80000 → INJECT (put in context)
 *   - cells ≤ 40000 → TOOL_LOOKUP (agent tool returns top rows)
 *   - cells > 40000 → INDEXED_LOOKUP (MongoDB indexed queries + pagination)
 */
export type QueryStrategy = 'inject' | 'tool_lookup' | 'indexed_lookup';

export function determineQueryStrategy(meta: StructuredDetectionResult['meta']): QueryStrategy {
    const cells = meta.rowCount * meta.colCount;

    if (cells <= 8000 && meta.totalChars <= 80000) {
        return 'inject';
    }
    if (cells <= 40000) {
        return 'tool_lookup';
    }
    return 'indexed_lookup';
}

/**
 * Format structured data for context injection (small tables).
 * Returns a compact Markdown table (only first 500 rows / 80K chars max).
 */
export function formatForContextInjection(
    rows: Array<Record<string, string>>,
    headers: string[],
    sheetNames: string[]
): string {
    const MAX_CHARS = 80000;
    let output = '';

    // Group rows by sheet
    const bySheet = new Map<string, Array<Record<string, string>>>();
    for (const row of rows) {
        const sheet = row._sheet || 'Sheet1';
        if (!bySheet.has(sheet)) bySheet.set(sheet, []);
        bySheet.get(sheet)!.push(row);
    }

    for (const [sheetName, sheetRows] of bySheet) {
        if (output.length >= MAX_CHARS) break;
        const sheetHeaders = headers.filter(h => h !== '_sheet' && sheetRows.some(r => r[h]));
        if (sheetHeaders.length === 0) continue;

        output += `\n### ${sheetName}\n`;
        output += `| ${sheetHeaders.join(' | ')} |\n`;
        output += `| ${sheetHeaders.map(() => '---').join(' | ')} |\n`;

        for (const row of sheetRows) {
            if (output.length >= MAX_CHARS) {
                output += `\n... (${sheetRows.length} rows total, truncated)\n`;
                break;
            }
            const values = sheetHeaders.map(h => (row[h] || '').replace(/\|/g, '\\|').substring(0, 200));
            output += `| ${values.join(' | ')} |\n`;
        }
    }

    return output.trim();
}
