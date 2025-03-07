import axios from 'axios';
import cheerio from 'cheerio';
import { URL } from 'url';

export class WebScraperService {
  private visitedUrls = new Set<string>();
  private baseUrl: string = '';

  async scrapeWebsite(startUrl: string, maxPages: number = 50): Promise<string[]> {
    this.visitedUrls.clear();
    this.baseUrl = new URL(startUrl).origin;
    const texts: string[] = [];
    
    try {
      await this.crawl(startUrl, texts, maxPages);
      return texts;
    } catch (error) {
      console.error('Error scraping website:', error);
      throw error;
    }
  }

  private async crawl(url: string, texts: string[], maxPages: number): Promise<void> {
    if (this.visitedUrls.size >= maxPages || this.visitedUrls.has(url)) {
      return;
    }

    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);
      this.visitedUrls.add(url);

      // Extract text content
      const text = $('body').text()
        .replace(/\s+/g, ' ')
        .trim();
      texts.push(text);

      // Find all links
      const links = $('a')
        .map((_, el) => $(el).attr('href'))
        .get()
        .filter(href => href && this.isValidInternalLink(href))
        .map(href => this.resolveUrl(href));

      // Recursively crawl found links
      for (const link of links) {
        if (this.visitedUrls.size < maxPages) {
          await this.crawl(link, texts, maxPages);
        }
      }
    } catch (error) {
      console.error(`Error crawling ${url}:`, error);
    }
  }

  private isValidInternalLink(href: string): boolean {
    if (!href) return false;
    if (href.startsWith('#')) return false;
    if (href.startsWith('javascript:')) return false;
    if (href.startsWith('mailto:')) return false;
    if (href.startsWith('tel:')) return false;
    
    try {
      const url = new URL(href, this.baseUrl);
      return url.origin === this.baseUrl;
    } catch {
      return true; // Relative URLs are valid
    }
  }

  private resolveUrl(href: string): string {
    try {
      return new URL(href, this.baseUrl).href;
    } catch {
      return href;
    }
  }
}

export const webScraperService = new WebScraperService(); 