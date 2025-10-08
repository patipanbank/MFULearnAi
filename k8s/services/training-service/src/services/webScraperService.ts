import axios from 'axios';
import * as cheerio from 'cheerio';

export class WebScraperService {
  private readonly MAX_CONTENT_LENGTH = 1000000; // 1MB
  private readonly TIMEOUT = 30000; // 30 seconds

  async scrapeUrl(url: string): Promise<string> {
    try {
      console.log(`Scraping URL: ${url}`);

      // Validate URL
      if (!this.isValidUrl(url)) {
        throw new Error('Invalid URL format');
      }

      // Fetch the webpage
      const response = await axios.get(url, {
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

      // Parse HTML content
      const $ = cheerio.load(response.data);

      // Remove script and style elements
      $('script, style, nav, header, footer, aside').remove();

      // Extract text content
      let textContent = '';

      // Try to get main content first
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
      } else {
        // Fallback to body content
        textContent = $('body').text().trim();
      }

      // Clean up text
      textContent = this.cleanText(textContent);

      console.log(`Scraped content: ${textContent.length} characters from ${url}`);

      if (textContent.length < 10) {
        throw new Error('Insufficient content found on the webpage');
      }

      return textContent;

    } catch (error: any) {
      console.error(`Error scraping URL ${url}:`, error.message);

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

  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private cleanText(text: string): string {
    return text
      // Replace multiple whitespaces with single space
      .replace(/\s+/g, ' ')
      // Remove excessive newlines
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // Trim whitespace
      .trim();
  }

  async validateUrl(url: string): Promise<{ valid: boolean; error?: string }> {
    try {
      if (!this.isValidUrl(url)) {
        return { valid: false, error: 'Invalid URL format' };
      }

      // Quick HEAD request to check if URL is accessible
      const response = await axios.head(url, {
        timeout: 10000,
        validateStatus: (status) => status < 400
      });

      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: error.response?.status ? `HTTP ${error.response.status}` : error.message
      };
    }
  }
}

export const webScraperService = new WebScraperService();
