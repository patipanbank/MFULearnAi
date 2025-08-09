export declare class WebScraperService {
    private readonly MAX_CONTENT_LENGTH;
    private readonly TIMEOUT;
    scrapeUrl(url: string): Promise<string>;
    private isValidUrl;
    private cleanText;
    validateUrl(url: string): Promise<{
        valid: boolean;
        error?: string;
    }>;
}
export declare const webScraperService: WebScraperService;
//# sourceMappingURL=webScraperService.d.ts.map