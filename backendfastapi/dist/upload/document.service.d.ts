export declare class DocumentService {
    private readonly logger;
    parseFileContent(buffer: Buffer, filename: string): Promise<string>;
    private parseTextFile;
    private parsePdfFile;
    private parseDocxFile;
    private parseDocFile;
    private parseCsvFile;
    private parseJsonFile;
    private parseMarkdownFile;
    getSupportedFileTypes(): string[];
    isFileTypeSupported(filename: string): boolean;
    getFileSizeMB(buffer: Buffer): number;
    validateFileSize(buffer: Buffer, maxSizeMB?: number): boolean;
}
