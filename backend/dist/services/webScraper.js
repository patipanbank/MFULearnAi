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
    async scrapeUrl(url) {
        try {
            const response = await axios_1.default.get(url);
            const $ = cheerio.load(response.data);
            // ลบ elements ที่ไม่ต้องการ
            $('script').remove();
            $('style').remove();
            $('nav').remove();
            $('footer').remove();
            $('header').remove();
            // ดึงเนื้อหาที่ต้องการ
            const content = $('body').text()
                .replace(/\s+/g, ' ')
                .trim();
            return content;
        }
        catch (error) {
            console.error(`Error scraping URL ${url}:`, error);
            throw error;
        }
    }
    async scrapeUrls(urls) {
        const results = await Promise.all(urls.map(async (url) => {
            try {
                const content = await this.scrapeUrl(url);
                return { url, content };
            }
            catch (error) {
                console.error(`Failed to scrape ${url}:`, error);
                return { url, content: '' };
            }
        }));
        return results.filter(result => result.content);
    }
}
exports.WebScraperService = WebScraperService;
exports.webScraperService = new WebScraperService();
