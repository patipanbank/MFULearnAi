"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentService = void 0;
const common_1 = require("@nestjs/common");
const pdf_parse_1 = require("pdf-parse");
let DocumentService = class DocumentService {
    async parseFileContent(buffer, filename) {
        const lower = filename.toLowerCase();
        if (lower.endsWith('.pdf')) {
            try {
                const data = await (0, pdf_parse_1.default)(buffer);
                return data.text || '';
            }
            catch (e) {
                return '';
            }
        }
        return buffer.toString('utf-8');
    }
};
exports.DocumentService = DocumentService;
exports.DocumentService = DocumentService = __decorate([
    (0, common_1.Injectable)()
], DocumentService);
//# sourceMappingURL=document.service.js.map