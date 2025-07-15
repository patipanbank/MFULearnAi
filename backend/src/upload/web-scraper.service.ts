import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

@Injectable()
export class WebScraperService {
  private readonly logger = new Logger(WebScraperService.name);
  private browser: puppeteer.Browser | null = null;

  /**
   * Initialize browser
   */
  private async getBrowser(): Promise<puppeteer.Browser> {
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

  /**
   * Scrape content from URL
   */
  async scrapeUrl(url: string): Promise<string> {
    try {
      this.logger.log(`🌐 Scraping URL: ${url}`);

      if (!this.isValidUrl(url)) {
        throw new Error('Invalid URL format');
      }

      const browser = await this.getBrowser();
      const page = await browser.newPage();

      // Set user agent to avoid being blocked
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Navigate to the page
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Get the page content
      const html = await page.content();
      await page.close();

      // Extract text content
      const textContent = this.extractTextFromHtml(html);
      
      if (!textContent.trim()) {
        throw new Error('No text content found on the page');
      }

      this.logger.log(`✅ Successfully scraped ${textContent.length} characters from ${url}`);
      return textContent;
    } catch (error) {
      this.logger.error(`Error scraping URL ${url}: ${error.message}`);
      throw new Error(`Failed to scrape URL ${url}: ${error.message}`);
    }
  }

  /**
   * Extract text content from HTML
   */
  private extractTextFromHtml(html: string): string {
    const $ = cheerio.load(html);
    
    // Remove script and style elements
    $('script, style, noscript').remove();
    
    // Remove navigation, footer, and other non-content elements
    $('nav, footer, header, aside, .nav, .footer, .header, .sidebar, .advertisement, .ads').remove();
    
    // Get text from main content areas
    let text = '';
    
    // Try to get content from main, article, or content areas first
    const mainContent = $('main, article, .content, .post-content, .entry-content, #content, #main');
    if (mainContent.length > 0) {
      text = mainContent.text();
    } else {
      // Fallback to body text
      text = $('body').text();
    }
    
    // Clean up the text
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get page title from HTML
   */
  private extractTitleFromHtml(html: string): string {
    const $ = cheerio.load(html);
    return $('title').text().trim() || $('h1').first().text().trim();
  }

  /**
   * Get meta description from HTML
   */
  private extractMetaDescriptionFromHtml(html: string): string {
    const $ = cheerio.load(html);
    return $('meta[name="description"]').attr('content') || 
           $('meta[property="og:description"]').attr('content') || '';
  }

  /**
   * Scrape with advanced options
   */
  async scrapeUrlAdvanced(url: string, options: {
    extractTitle?: boolean;
    extractMeta?: boolean;
    includeLinks?: boolean;
    maxLength?: number;
  } = {}): Promise<{
    title: string;
    description: string;
    content: string;
    links: string[];
  }> {
    try {
      this.logger.log(`🌐 Advanced scraping URL: ${url}`);

      if (!this.isValidUrl(url)) {
        throw new Error('Invalid URL format');
      }

      const browser = await this.getBrowser();
      const page = await browser.newPage();

      // Set user agent
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

      // Navigate to the page
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Get the page content
      const html = await page.content();
      
      // Extract links if requested
      let links: string[] = [];
      if (options.includeLinks) {
        const rawLinks = await page.evaluate(() => {
          const anchors = document.querySelectorAll('a[href]');
          return Array.from(anchors, a => a.getAttribute('href'));
        });
        links = rawLinks.filter(href => href && href.startsWith('http')) as string[];
      }

      await page.close();

      // Extract content
      const title = options.extractTitle ? this.extractTitleFromHtml(html) : '';
      const description = options.extractMeta ? this.extractMetaDescriptionFromHtml(html) : '';
      const content = this.extractTextFromHtml(html);

      // Apply max length if specified
      const finalContent = options.maxLength && content.length > options.maxLength 
        ? content.substring(0, options.maxLength) + '...' 
        : content;

      return {
        title,
        description,
        content: finalContent,
        links: links.slice(0, 10), // Limit to 10 links
      };
    } catch (error) {
      this.logger.error(`Error in advanced scraping for URL ${url}: ${error.message}`);
      throw new Error(`Failed to scrape URL ${url}: ${error.message}`);
    }
  }

  /**
   * Check if URL is accessible
   */
  async isUrlAccessible(url: string): Promise<boolean> {
    try {
      if (!this.isValidUrl(url)) {
        return false;
      }

      const browser = await this.getBrowser();
      const page = await browser.newPage();
      
      // Set a short timeout for accessibility check
      await page.setDefaultNavigationTimeout(10000);
      
      const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.close();
      
      return response?.ok() || false;
    } catch (error) {
      this.logger.error(`Error checking URL accessibility for ${url}: ${error.message}`);
      return false;
    }
  }

  /**
   * Get supported content types
   */
  getSupportedContentTypes(): string[] {
    return ['text/html', 'text/plain', 'application/json'];
  }

  /**
   * Check if content type is supported
   */
  isContentTypeSupported(contentType: string): boolean {
    return this.getSupportedContentTypes().some(type => 
      contentType.toLowerCase().includes(type)
    );
  }

  /**
   * Close browser when service is destroyed
   */
  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
} 