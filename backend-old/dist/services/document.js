"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentService = exports.DocumentService = void 0;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mammoth_1 = __importDefault(require("mammoth"));
const xlsx_1 = __importDefault(require("xlsx"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const tesseract_js_1 = require("tesseract.js");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs_1 = require("fs");
const csv_parser_1 = __importDefault(require("csv-parser"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class DocumentService {
    cleanText(text) {
        return text
            .split('\n')
            .filter(line => line.trim().length > 0)
            .join('\n')
            .replace(/\s+/g, ' ')
            .trim();
    }
    async processPDFInChunks(filePath) {
        let text = '';
        const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
        const fileStream = (0, fs_1.createReadStream)(filePath, { highWaterMark: CHUNK_SIZE });
        return new Promise((resolve, reject) => {
            let buffer = Buffer.from([]);
            fileStream.on('data', (chunk) => {
                buffer = Buffer.concat([buffer, chunk]);
            });
            fileStream.on('end', async () => {
                try {
                    const pdfData = await (0, pdf_parse_1.default)(buffer);
                    text = this.cleanText(pdfData.text);
                    resolve(text);
                }
                catch (error) {
                    reject(error);
                }
            });
            fileStream.on('error', (error) => reject(error));
        });
    }
    async processCSVInChunks(filePath) {
        let text = '';
        return new Promise((resolve, reject) => {
            (0, fs_1.createReadStream)(filePath)
                .pipe((0, csv_parser_1.default)())
                .on('data', (row) => {
                const values = Object.values(row)
                    .filter(value => value && value.trim().length > 0);
                if (values.length > 0) {
                    text += values.join(',') + '\n';
                }
            })
                .on('end', () => resolve(this.cleanText(text)))
                .on('error', (error) => reject(error));
        });
    }
    async processFile(file) {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        let worker = null;
        const tempFiles = [];
        try {
            let text = '';
            switch (ext) {
                case '.pdf':
                    try {
                        text = await this.processPDFInChunks(file.path);
                        if (!text || text.trim().length < 100) {
                            const outputPath = `${file.path}-page`;
                            await execAsync(`pdftoppm -png "${file.path}" "${outputPath}"`);
                            worker = await (0, tesseract_js_1.createWorker)('eng+tha');
                            const pages = await promises_1.default.readdir(path_1.default.dirname(file.path));
                            let ocrText = '';
                            for (const page of pages.filter(p => p.startsWith(path_1.default.basename(outputPath)))) {
                                const pagePath = path_1.default.join(path_1.default.dirname(file.path), page);
                                tempFiles.push(pagePath);
                                const { data: { text: pageText } } = await worker.recognize(pagePath);
                                ocrText += pageText + '\n';
                            }
                            // Cleanup OCR worker
                            if (worker) {
                                await worker.terminate();
                                worker = null;
                            }
                            // Cleanup temporary files
                            for (const tempFile of tempFiles) {
                                try {
                                    await promises_1.default.unlink(tempFile);
                                }
                                catch (err) {
                                    console.error(`Failed to delete temp file ${tempFile}:`, err);
                                }
                            }
                            tempFiles.length = 0;
                            text = this.cleanText(ocrText);
                        }
                    }
                    catch (error) {
                        console.error('PDF processing error:', error);
                        // Ensure cleanup on error
                        if (worker) {
                            try {
                                await worker.terminate();
                            }
                            catch (err) {
                                console.error('Error terminating OCR worker:', err);
                            }
                        }
                        for (const tempFile of tempFiles) {
                            try {
                                await promises_1.default.unlink(tempFile);
                            }
                            catch (err) {
                                console.error(`Failed to delete temp file ${tempFile}:`, err);
                            }
                        }
                        throw error;
                    }
                    break;
                case '.doc':
                case '.docx':
                    const buffer = await promises_1.default.readFile(file.path);
                    const wordResult = await mammoth_1.default.extractRawText({ buffer });
                    text = this.cleanText(wordResult.value);
                    break;
                case '.xls':
                case '.xlsx':
                    const workbook = xlsx_1.default.read(await promises_1.default.readFile(file.path));
                    text = workbook.SheetNames.map(name => {
                        const sheet = workbook.Sheets[name];
                        return `[Sheet: ${name}]\n${xlsx_1.default.utils.sheet_to_csv(sheet)}`;
                    }).join('\n\n');
                    text = this.cleanText(text);
                    break;
                case '.txt':
                    text = await promises_1.default.readFile(file.path, 'utf-8');
                    text = this.cleanText(text);
                    break;
                case '.csv':
                    text = await this.processCSVInChunks(file.path);
                    break;
                default:
                    throw new Error('Unsupported file type');
            }
            // Cleanup uploaded file
            try {
                await promises_1.default.unlink(file.path);
            }
            catch (err) {
                console.error(`Failed to delete uploaded file ${file.path}:`, err);
            }
            return text;
        }
        catch (error) {
            console.error(`Error processing file ${file.originalname}:`, error);
            // Ensure cleanup on error
            try {
                await promises_1.default.unlink(file.path);
            }
            catch (err) {
                console.error(`Failed to delete uploaded file ${file.path}:`, err);
            }
            throw error;
        }
    }
}
exports.DocumentService = DocumentService;
exports.documentService = new DocumentService();
