"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentService = exports.DocumentService = void 0;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mammoth = __importStar(require("mammoth"));
const XLSX = __importStar(require("xlsx"));
const csv_parser_1 = __importDefault(require("csv-parser"));
const stream_1 = require("stream");
class DocumentService {
    async parseFileContent(fileBuffer, fileName) {
        const fileExtension = fileName.split('.').pop()?.toLowerCase();
        console.log(`📄 Parsing file: ${fileName} (${fileExtension})`);
        try {
            switch (fileExtension) {
                case 'txt':
                    return this.parseTextFile(fileBuffer);
                case 'pdf':
                    return await this.parsePdfFile(fileBuffer);
                case 'doc':
                case 'docx':
                    return await this.parseWordFile(fileBuffer);
                case 'csv':
                    return await this.parseCsvFile(fileBuffer);
                case 'xls':
                case 'xlsx':
                    return this.parseExcelFile(fileBuffer);
                default:
                    console.log(`⚠️ Unknown file type: ${fileExtension}, trying as text`);
                    return this.parseTextFile(fileBuffer);
            }
        }
        catch (error) {
            console.error(`❌ Error parsing file ${fileName}:`, error);
            throw new Error(`Failed to parse ${fileExtension} file: ${error?.message || error}`);
        }
    }
    parseTextFile(fileBuffer) {
        const content = fileBuffer.toString('utf-8');
        console.log(`✅ Text file parsed: ${content.length} characters`);
        return content;
    }
    async parsePdfFile(fileBuffer) {
        try {
            const data = await (0, pdf_parse_1.default)(fileBuffer);
            console.log(`✅ PDF parsed: ${data.text.length} characters, ${data.numpages} pages`);
            return data.text;
        }
        catch (error) {
            console.error('❌ PDF parsing failed:', error);
            throw new Error(`Failed to parse PDF: ${error?.message || error}`);
        }
    }
    async parseWordFile(fileBuffer) {
        try {
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            console.log(`✅ Word document parsed: ${result.value.length} characters`);
            if (result.messages.length > 0) {
                console.log('⚠️ Word parsing warnings:', result.messages);
            }
            return result.value;
        }
        catch (error) {
            console.error('❌ Word document parsing failed:', error);
            throw new Error(`Failed to parse Word document: ${error?.message || error}`);
        }
    }
    async parseCsvFile(fileBuffer) {
        return new Promise((resolve, reject) => {
            const results = [];
            const stream = stream_1.Readable.from(fileBuffer);
            stream
                .pipe((0, csv_parser_1.default)())
                .on('data', (data) => results.push(data))
                .on('end', () => {
                try {
                    const text = results.map(row => {
                        return Object.entries(row)
                            .map(([key, value]) => `${key}: ${value}`)
                            .join(', ');
                    }).join('\n');
                    console.log(`✅ CSV parsed: ${results.length} rows, ${text.length} characters`);
                    resolve(text);
                }
                catch (error) {
                    reject(error);
                }
            })
                .on('error', (error) => {
                console.error('❌ CSV parsing failed:', error);
                reject(new Error(`Failed to parse CSV: ${error?.message || error}`));
            });
        });
    }
    parseExcelFile(fileBuffer) {
        try {
            const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
            let allText = '';
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                const sheetText = sheetData.map((row) => row.join(', ')).join('\n');
                allText += `Sheet: ${sheetName}\n${sheetText}\n\n`;
            });
            console.log(`✅ Excel parsed: ${workbook.SheetNames.length} sheets, ${allText.length} characters`);
            return allText;
        }
        catch (error) {
            console.error('❌ Excel parsing failed:', error);
            throw new Error(`Failed to parse Excel file: ${error?.message || error}`);
        }
    }
}
exports.DocumentService = DocumentService;
exports.documentService = new DocumentService();
//# sourceMappingURL=documentService.js.map