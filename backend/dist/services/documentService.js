"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentService = exports.DocumentService = void 0;
class DocumentService {
    async parseFileContent(fileBuffer, fileName) {
        const fileExtension = fileName.split('.').pop()?.toLowerCase();
        switch (fileExtension) {
            case 'txt':
                return this.parseTextFile(fileBuffer);
            case 'pdf':
                return this.parsePdfFile(fileBuffer);
            case 'doc':
            case 'docx':
                return this.parseWordFile(fileBuffer);
            case 'csv':
                return this.parseCsvFile(fileBuffer);
            case 'xls':
            case 'xlsx':
                return this.parseExcelFile(fileBuffer);
            default:
                return this.parseTextFile(fileBuffer);
        }
    }
    parseTextFile(fileBuffer) {
        return fileBuffer.toString('utf-8');
    }
    parsePdfFile(fileBuffer) {
        return `PDF content from ${fileBuffer.length} bytes`;
    }
    parseWordFile(fileBuffer) {
        return `Word document content from ${fileBuffer.length} bytes`;
    }
    parseCsvFile(fileBuffer) {
        return `CSV content from ${fileBuffer.length} bytes`;
    }
    parseExcelFile(fileBuffer) {
        return `Excel content from ${fileBuffer.length} bytes`;
    }
}
exports.DocumentService = DocumentService;
exports.documentService = new DocumentService();
//# sourceMappingURL=documentService.js.map