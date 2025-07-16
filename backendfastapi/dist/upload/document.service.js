"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var DocumentService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentService = void 0;
const common_1 = require("@nestjs/common");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
let DocumentService = DocumentService_1 = class DocumentService {
    logger = new common_1.Logger(DocumentService_1.name);
    async parseFileContent(buffer, filename) {
        try {
            const extension = filename.split('.').pop()?.toLowerCase();
            switch (extension) {
                case 'txt':
                    return this.parseTextFile(buffer);
                case 'pdf':
                    return await this.parsePdfFile(buffer);
                case 'docx':
                    return await this.parseDocxFile(buffer);
                case 'doc':
                    return await this.parseDocFile(buffer);
                case 'csv':
                    return this.parseCsvFile(buffer);
                case 'json':
                    return this.parseJsonFile(buffer);
                case 'md':
                case 'markdown':
                    return this.parseMarkdownFile(buffer);
                default:
                    return this.parseTextFile(buffer);
            }
        }
        catch (error) {
            this.logger.error(`Error parsing file ${filename}: ${error.message}`);
            throw new Error(`Failed to parse file ${filename}: ${error.message}`);
        }
    }
    parseTextFile(buffer) {
        return buffer.toString('utf-8');
    }
    async parsePdfFile(buffer) {
        try {
            this.logger.log('📄 Parsing PDF file using pdf-parse');
            const data = await pdfParse(buffer);
            if (!data.text || data.text.trim().length === 0) {
                throw new Error('No text content found in PDF');
            }
            this.logger.log(`✅ Successfully extracted ${data.text.length} characters from PDF`);
            return data.text;
        }
        catch (error) {
            this.logger.error(`Error parsing PDF: ${error.message}`);
            throw new Error(`Failed to parse PDF: ${error.message}`);
        }
    }
    async parseDocxFile(buffer) {
        try {
            this.logger.log('📄 Parsing DOCX file using mammoth');
            const result = await mammoth.extractRawText({ buffer });
            if (!result.value || result.value.trim().length === 0) {
                throw new Error('No text content found in DOCX');
            }
            this.logger.log(`✅ Successfully extracted ${result.value.length} characters from DOCX`);
            return result.value;
        }
        catch (error) {
            this.logger.error(`Error parsing DOCX: ${error.message}`);
            throw new Error(`Failed to parse DOCX: ${error.message}`);
        }
    }
    async parseDocFile(buffer) {
        try {
            this.logger.log('📄 Attempting to parse DOC file');
            try {
                return await this.parseDocxFile(buffer);
            }
            catch (error) {
                this.logger.warn('Failed to parse as DOCX, trying alternative method');
            }
            throw new Error('DOC file parsing requires additional setup. Please convert to DOCX or PDF first.');
        }
        catch (error) {
            this.logger.error(`Error parsing DOC: ${error.message}`);
            throw new Error(`Failed to parse DOC: ${error.message}`);
        }
    }
    parseCsvFile(buffer) {
        const csvContent = buffer.toString('utf-8');
        const lines = csvContent.split('\n');
        const textLines = lines.map(line => {
            const columns = line.split(',').map(col => col.trim().replace(/"/g, ''));
            return columns.join(' | ');
        });
        return textLines.join('\n');
    }
    parseJsonFile(buffer) {
        try {
            const jsonContent = buffer.toString('utf-8');
            const parsed = JSON.parse(jsonContent);
            return JSON.stringify(parsed, null, 2);
        }
        catch (error) {
            this.logger.error('Error parsing JSON file:', error);
            return buffer.toString('utf-8');
        }
    }
    parseMarkdownFile(buffer) {
        const markdownContent = buffer.toString('utf-8');
        return markdownContent
            .replace(/#{1,6}\s+/g, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/\*(.*?)\*/g, '$1')
            .replace(/`(.*?)`/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
            .replace(/```[\s\S]*?```/g, '')
            .replace(/^\s*[-*+]\s+/gm, '')
            .replace(/^\s*\d+\.\s+/gm, '')
            .trim();
    }
    getSupportedFileTypes() {
        return [
            'txt', 'pdf', 'docx', 'doc', 'csv', 'json', 'md', 'markdown'
        ];
    }
    isFileTypeSupported(filename) {
        const extension = filename.split('.').pop()?.toLowerCase();
        return extension ? this.getSupportedFileTypes().includes(extension) : false;
    }
    getFileSizeMB(buffer) {
        return buffer.length / (1024 * 1024);
    }
    validateFileSize(buffer, maxSizeMB = 50) {
        const fileSizeMB = this.getFileSizeMB(buffer);
        return fileSizeMB <= maxSizeMB;
    }
};
exports.DocumentService = DocumentService;
exports.DocumentService = DocumentService = DocumentService_1 = __decorate([
    (0, common_1.Injectable)()
], DocumentService);
//# sourceMappingURL=document.service.js.map