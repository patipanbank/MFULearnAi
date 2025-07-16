"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var WebScraperService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebScraperService = void 0;
const common_1 = require("@nestjs/common");
const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
let WebScraperService = WebScraperService_1 = class WebScraperService {
    logger = new common_1.Logger(WebScraperService_1.name);
    browser = null;
    async getBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });
        }
        return this.browser;
    }
    async scrapeUrl(url) {
        try {
            this.logger.log(`🌐 Scraping URL: ${url}`);
            if (!this.isValidUrl(url)) {
                throw new Error('Invalid URL format');
            }
            const browser = await this.getBrowser();
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            const html = await page.content();
            await page.close();
            const textContent = this.extractTextFromHtml(html);
            if (!textContent.trim()) {
                throw new Error('No text content found on the page');
            }
            this.logger.log(`✅ Successfully scraped ${textContent.length} characters from ${url}`);
            return textContent;
        }
        catch (error) {
            this.logger.error(`Error scraping URL ${url}: ${error.message}`);
            throw new Error(`Failed to scrape URL ${url}: ${error.message}`);
        }
    }
    extractTextFromHtml(html) {
        const $ = cheerio.load(html);
        $('script, style, noscript').remove();
        $('nav, footer, header, aside, .nav, .footer, .header, .sidebar, .advertisement, .ads').remove();
        let text = '';
        const mainContent = $('main, article, .content, .post-content, .entry-content, #content, #main');
        if (mainContent.length > 0) {
            text = mainContent.text();
        }
        else {
            text = $('body').text();
        }
        return text
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n')
            .trim();
    }
    isValidUrl(url) {
        try {
            new URL(url);
            return true;
        }
        catch {
            return false;
        }
    }
    extractTitleFromHtml(html) {
        const $ = cheerio.load(html);
        return $('title').text().trim() || $('h1').first().text().trim();
    }
    extractMetaDescriptionFromHtml(html) {
        const $ = cheerio.load(html);
        return $('meta[name="description"]').attr('content') ||
            $('meta[property="og:description"]').attr('content') || '';
    }
    async scrapeUrlAdvanced(url, options = {}) {
        try {
            this.logger.log(`🌐 Advanced scraping URL: ${url}`);
            if (!this.isValidUrl(url)) {
                throw new Error('Invalid URL format');
            }
            const browser = await this.getBrowser();
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            const html = await page.content();
            let links = [];
            if (options.includeLinks) {
                const rawLinks = await page.evaluate(() => {
                    const anchors = document.querySelectorAll('a[href]');
                    return Array.from(anchors, a => a.getAttribute('href'));
                });
                links = rawLinks.filter(href => href && href.startsWith('http'));
            }
            await page.close();
            const title = options.extractTitle ? this.extractTitleFromHtml(html) : '';
            const description = options.extractMeta ? this.extractMetaDescriptionFromHtml(html) : '';
            const content = this.extractTextFromHtml(html);
            const finalContent = options.maxLength && content.length > options.maxLength
                ? content.substring(0, options.maxLength) + '...'
                : content;
            return {
                title,
                description,
                content: finalContent,
                links: links.slice(0, 10),
            };
        }
        catch (error) {
            this.logger.error(`Error in advanced scraping for URL ${url}: ${error.message}`);
            throw new Error(`Failed to scrape URL ${url}: ${error.message}`);
        }
    }
    async isUrlAccessible(url) {
        try {
            if (!this.isValidUrl(url)) {
                return false;
            }
            const browser = await this.getBrowser();
            const page = await browser.newPage();
            await page.setDefaultNavigationTimeout(10000);
            const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
            await page.close();
            return response?.ok() || false;
        }
        catch (error) {
            this.logger.error(`Error checking URL accessibility for ${url}: ${error.message}`);
            return false;
        }
    }
    getSupportedContentTypes() {
        return ['text/html', 'text/plain', 'application/json'];
    }
    isContentTypeSupported(contentType) {
        return this.getSupportedContentTypes().some(type => contentType.toLowerCase().includes(type));
    }
    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
};
exports.WebScraperService = WebScraperService;
exports.WebScraperService = WebScraperService = WebScraperService_1 = __decorate([
    (0, common_1.Injectable)()
], WebScraperService);
//# sourceMappingURL=web-scraper.service.js.map