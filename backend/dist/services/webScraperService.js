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
exports.webScraperService = exports.WebScraperService = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
class WebScraperService {
    constructor() {
        this.MAX_CONTENT_LENGTH = 1000000;
        this.TIMEOUT = 30000;
    }
    async scrapeUrl(url) {
        try {
            console.log(`🌐 Scraping URL: ${url}`);
            if (!this.isValidUrl(url)) {
                throw new Error('Invalid URL format');
            }
            const response = await axios_1.default.get(url, {
                timeout: this.TIMEOUT,
                maxContentLength: this.MAX_CONTENT_LENGTH,
                headers: {
                    'User-Agent': 'MFU Learn AI Bot/1.0 (+https://mfulearning.ai)'
                },
                validateStatus: (status) => status < 400
            });
            if (!response.data) {
                throw new Error('No content received from URL');
            }
            const $ = cheerio.load(response.data);
            $('script, style, nav, header, footer, aside').remove();
            let textContent = '';
            const mainSelectors = [
                'main',
                'article',
                '.content',
                '.main-content',
                '#content',
                '#main'
            ];
            let mainContent = '';
            for (const selector of mainSelectors) {
                const element = $(selector);
                if (element.length > 0 && element.text().trim().length > 100) {
                    mainContent = element.text().trim();
                    break;
                }
            }
            if (mainContent) {
                textContent = mainContent;
            }
            else {
                textContent = $('body').text().trim();
            }
            textContent = this.cleanText(textContent);
            console.log(`✅ Scraped content: ${textContent.length} characters from ${url}`);
            if (textContent.length < 10) {
                throw new Error('Insufficient content found on the webpage');
            }
            return textContent;
        }
        catch (error) {
            console.error(`❌ Error scraping URL ${url}:`, error.message);
            if (error.code === 'ENOTFOUND') {
                throw new Error('Website not found. Please check the URL.');
            }
            if (error.code === 'ECONNREFUSED') {
                throw new Error('Connection refused. The website may be down.');
            }
            if (error.code === 'ETIMEDOUT') {
                throw new Error('Request timeout. The website is taking too long to respond.');
            }
            if (error.response?.status === 403) {
                throw new Error('Access denied. The website blocks automated access.');
            }
            if (error.response?.status === 404) {
                throw new Error('Page not found (404).');
            }
            if (error.response?.status >= 500) {
                throw new Error('Server error. The website is experiencing issues.');
            }
            throw new Error(`Failed to scrape URL: ${error.message}`);
        }
    }
    isValidUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        }
        catch {
            return false;
        }
    }
    cleanText(text) {
        return text
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .trim();
    }
    async validateUrl(url) {
        try {
            if (!this.isValidUrl(url)) {
                return { valid: false, error: 'Invalid URL format' };
            }
            const response = await axios_1.default.head(url, {
                timeout: 10000,
                validateStatus: (status) => status < 400
            });
            return { valid: true };
        }
        catch (error) {
            return {
                valid: false,
                error: error.response?.status ? `HTTP ${error.response.status}` : error.message
            };
        }
    }
}
exports.WebScraperService = WebScraperService;
exports.webScraperService = new WebScraperService();
//# sourceMappingURL=webScraperService.js.map