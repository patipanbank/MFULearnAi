export declare class DocumentService {
    parseFileContent(fileBuffer: Buffer, fileName: string): Promise<string>;
    private parseTextFile;
    private parsePdfFile;
    private parseWordFile;
    private parseCsvFile;
    private parseExcelFile;
}
export declare const documentService: DocumentService;
//# sourceMappingURL=documentService.d.ts.map