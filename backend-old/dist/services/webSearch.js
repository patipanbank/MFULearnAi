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
exports.webSearchService = exports.WebSearchService = void 0;
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
class WebSearchService {
    constructor() {
        this.SEARCH_ENGINES = [
            'https://duckduckgo.com/html/',
            'https://www.bing.com/search'
        ];
        this.USER_AGENTS = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        ];
    }
    getRandomUserAgent() {
        return this.USER_AGENTS[Math.floor(Math.random() * this.USER_AGENTS.length)];
    }
    async searchWeb(query) {
        try {
            // สุ่มเลือก search engine
            const searchUrl = this.SEARCH_ENGINES[0]; // เริ่มด้วย DuckDuckGo
            const response = await axios_1.default.get(searchUrl, {
                params: { q: query },
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Accept': 'text/html',
                    'Accept-Language': 'en-US,en;q=0.9,th;q=0.8'
                },
                timeout: 5000
            });
            const $ = cheerio.load(response.data);
            let results = [];
            // Parser สำหรับ DuckDuckGo
            $('.result').each((i, element) => {
                if (i < 5) { // จำกัดแค่ 5 ผลลัพธ์
                    const title = $(element).find('.result__title').text().trim();
                    const snippet = $(element).find('.result__snippet').text().trim();
                    const link = $(element).find('.result__url').text().trim();
                    if (title && snippet) {
                        results.push(`[${title}]\n${snippet}\nSource: ${link}\n`);
                    }
                }
            });
            return results.join('\n');
        }
        catch (error) {
            console.error('Web search error:', error);
            return '';
        }
    }
    // เพิ่มฟังก์ชันสำหรับดึงข้อมูลจากเว็บไซต์โดยตรง
    async scrapeWebContent(url) {
        try {
            const response = await axios_1.default.get(url, {
                headers: {
                    'User-Agent': this.getRandomUserAgent()
                },
                timeout: 5000
            });
            const $ = cheerio.load(response.data);
            // ลบ elements ที่ไม่จำเป็น
            $('script').remove();
            $('style').remove();
            $('nav').remove();
            $('footer').remove();
            $('header').remove();
            $('aside').remove();
            // ดึงเนื้อหาหลัก
            const content = $('main, article, .content, #content, .main-content')
                .first()
                .text()
                .replace(/\s+/g, ' ')
                .trim();
            return content.substring(0, 2000); // จำกัดความยาว
        }
        catch (error) {
            console.error('Web scraping error:', error);
            return '';
        }
    }
}
exports.WebSearchService = WebSearchService;
exports.webSearchService = new WebSearchService();
