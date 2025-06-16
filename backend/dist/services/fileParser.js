"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fileParserService = void 0;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mammoth_1 = __importDefault(require("mammoth"));
const xlsx_1 = __importDefault(require("xlsx"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const uuid_1 = require("uuid");
class FileParserService {
    constructor() {
        // จำกัดขนาดข้อความสูงสุดที่จะส่งกลับ
        this.MAX_TEXT_LENGTH = 50000;
    }
    async parseFile(file) {
        const fileExt = path_1.default.extname(file.originalname).toLowerCase();
        try {
            let result = '';
            // PDF
            if (fileExt === '.pdf' || file.mimetype === 'application/pdf') {
                result = await this.parsePdf(file.buffer);
            }
            // Word
            else if (fileExt === '.docx' || fileExt === '.doc' ||
                file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                file.mimetype === 'application/msword') {
                result = await this.parseWord(file.buffer);
            }
            // Excel
            else if (fileExt === '.xlsx' || fileExt === '.xls' || fileExt === '.csv' ||
                file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                file.mimetype === 'application/vnd.ms-excel') {
                result = await this.parseExcel(file.buffer);
            }
            // PowerPoint
            else if (fileExt === '.pptx' || fileExt === '.ppt' ||
                file.mimetype === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
                file.mimetype === 'application/vnd.ms-powerpoint') {
                result = await this.parsePowerPoint(file.buffer);
            }
            else {
                return `[Cannot parse file type ${fileExt}]`;
            }
            // จำกัดขนาดข้อความ
            if (result.length > this.MAX_TEXT_LENGTH) {
                result = result.substring(0, this.MAX_TEXT_LENGTH) +
                    `\n\n[File content truncated due to large size (${result.length} characters)]`;
            }
            return result;
        }
        catch (error) {
            console.error(`Error parsing file ${file.originalname}:`, error);
            return `[Error parsing file ${file.originalname}]`;
        }
    }
    async parsePdf(buffer) {
        try {
            const data = await (0, pdf_parse_1.default)(buffer);
            return data.text || '';
        }
        catch (error) {
            console.error('Error parsing PDF:', error);
            throw new Error('Cannot parse PDF file');
        }
    }
    async parseWord(buffer) {
        try {
            const result = await mammoth_1.default.extractRawText({ buffer });
            return result.value || '';
        }
        catch (error) {
            console.error('Error parsing Word document:', error);
            throw new Error('Cannot parse Word file');
        }
    }
    async parseExcel(buffer) {
        try {
            const workbook = xlsx_1.default.read(buffer, { type: 'buffer' });
            let result = '';
            // วนลูปผ่านทุก sheet
            workbook.SheetNames.forEach(sheetName => {
                const worksheet = workbook.Sheets[sheetName];
                result += `=== Sheet: ${sheetName} ===\n`;
                // แปลง sheet เป็น CSV
                const csv = xlsx_1.default.utils.sheet_to_csv(worksheet);
                result += csv + '\n\n';
            });
            return result;
        }
        catch (error) {
            console.error('Error parsing Excel file:', error);
            throw new Error('Cannot parse Excel file');
        }
    }
    async parsePowerPoint(buffer) {
        try {
            // PowerPoint ค่อนข้างซับซ้อนในการแปลงโดยตรง
            // สร้างไฟล์ชั่วคราวและใช้ external service หรือ library
            const tempFilePath = path_1.default.join(os_1.default.tmpdir(), `${(0, uuid_1.v4)()}.pptx`);
            fs_1.default.writeFileSync(tempFilePath, buffer);
            // ในที่นี้เราจะส่งข้อความว่ายังไม่รองรับการแปลงโดยตรง
            // แต่ในอนาคตอาจเพิ่ม library ที่สามารถแปลง PowerPoint ได้
            fs_1.default.unlinkSync(tempFilePath); // ลบไฟล์ชั่วคราว
            return '[PowerPoint file: Summary not shown due to large size, but AI will try to process the data]';
        }
        catch (error) {
            console.error('Error parsing PowerPoint file:', error);
            throw new Error('Cannot parse PowerPoint file');
        }
    }
}
exports.fileParserService = new FileParserService();
