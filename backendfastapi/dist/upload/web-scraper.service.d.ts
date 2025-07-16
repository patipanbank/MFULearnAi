export declare class WebScraperService {
    private readonly logger;
    private browser;
    private getBrowser;
    scrapeUrl(url: string): Promise<string>;
    private extractTextFromHtml;
    private isValidUrl;
    private extractTitleFromHtml;
    private extractMetaDescriptionFromHtml;
    scrapeUrlAdvanced(url: string, options?: {
        extractTitle?: boolean;
        extractMeta?: boolean;
        includeLinks?: boolean;
        maxLength?: number;
    }): Promise<{
        title: string;
        description: string;
        content: string;
        links: string[];
    }>;
    isUrlAccessible(url: string): Promise<boolean>;
    getSupportedContentTypes(): string[];
    isContentTypeSupported(contentType: string): boolean;
    onModuleDestroy(): Promise<void>;
}
