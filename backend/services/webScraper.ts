import axios from 'axios';
import * as cheerio from 'cheerio';

export class WebScraperService {
  private visitedUrls = new Set<string>();
  private baseUrl: string = '';

  private isValidUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      // ตรวจสอบว่า URL อยู่ในโดเมนเดียวกันกับ baseUrl
      return parsedUrl.hostname === new URL(this.baseUrl).hostname;
    } catch {
      return false;
    }
  }

  private async extractUrls(html: string, baseUrl: string): Promise<string[]> {
    const $ = cheerio.load(html);
    const urls = new Set<string>();
    
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl).href;
          if (this.isValidUrl(absoluteUrl)) {
            urls.add(absoluteUrl);
          }
        } catch (error) {
          console.warn(`Invalid URL: ${href}`);
        }
      }
    });

    return Array.from(urls);
  }

  async crawlWebsite(startUrl: string, maxDepth: number = 2): Promise<Array<{url: string, content: string}>> {
    this.visitedUrls.clear();
    this.baseUrl = startUrl;
    const results: Array<{url: string, content: string}> = [];
    
    async function crawl(this: WebScraperService, url: string, depth: number) {
      if (depth > maxDepth || this.visitedUrls.has(url)) {
        return;
      }

      this.visitedUrls.add(url);

      try {
        const response = await axios.get(url);
        const content = await this.scrapeUrl(url);
        results.push({ url, content });

        const urls = await this.extractUrls(response.data, url);
        for (const newUrl of urls) {
          await crawl.call(this, newUrl, depth + 1);
        }
      } catch (error) {
        console.error(`Error crawling ${url}:`, error);
      }
    }

    await crawl.call(this, startUrl, 0);
    return results;
  }

  async scrapeUrl(url: string): Promise<string> {
    try {
      const response = await axios.get(url);
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
    } catch (error) {
      console.error(`Error scraping URL ${url}:`, error);
      throw error;
    }
  }

  async scrapeUrls(urls: string[]): Promise<Array<{url: string, content: string}>> {
    const results = await Promise.all(
      urls.map(async (url) => {
        try {
          const content = await this.scrapeUrl(url);
          return { url, content };
        } catch (error) {
          console.error(`Failed to scrape ${url}:`, error);
          return { url, content: '' };
        }
      })
    );
    return results.filter(result => result.content);
  }
}

export const webScraperService = new WebScraperService(); 