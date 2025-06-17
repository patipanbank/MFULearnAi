import axios from 'axios';
import * as cheerio from 'cheerio';

export class WebSearchService {
  private readonly SEARCH_ENGINES = [
    'https://duckduckgo.com/html/',
    'https://www.bing.com/search'
  ];
  private readonly USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  ];

  private getRandomUserAgent(): string {
    return this.USER_AGENTS[Math.floor(Math.random() * this.USER_AGENTS.length)];
  }

  async searchWeb(query: string): Promise<string> {
    console.log(`WebSearchService: Searching for "${query}"`);
    
    try {
      // Try DuckDuckGo first
      let results = await this.searchDuckDuckGo(query);
      
      if (!results || results.length === 0) {
        console.log('WebSearchService: DuckDuckGo failed, trying fallback search');
        results = await this.fallbackSearch(query);
      }

      if (!results || results.length === 0) {
        console.log('WebSearchService: All search methods failed');
        return 'Unable to retrieve search results at this time. Please try again later.';
      }

      console.log(`WebSearchService: Found ${results.length} results`);
      return results.join('\n\n');
      
    } catch (error) {
      console.error('WebSearchService: Search error:', error);
      return 'Search service is currently unavailable. Please try again later.';
    }
  }

  private async searchDuckDuckGo(query: string): Promise<string[]> {
    try {
      const searchUrl = 'https://duckduckgo.com/html/';
      
      const response = await axios.get(searchUrl, {
        params: { q: query },
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,th;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 10000, // Increase timeout
        maxRedirects: 5
      });

      const $ = cheerio.load(response.data);
      let results: string[] = [];

      // Updated selectors for current DuckDuckGo structure
      const searchResults = $('.result, .results_links, .web-result, .result--body');
      
      if (searchResults.length === 0) {
        // Try alternative selectors
        $('.links_main').each((i, element) => {
          if (i >= 5) return false; // Limit to 5 results
          
          const $element = $(element);
          const title = $element.find('a').first().text().trim() || 
                       $element.find('.result__title, .result-title').text().trim();
          const snippet = $element.find('.result__snippet, .result-snippet').text().trim() ||
                         $element.text().replace(title, '').trim();
          const link = $element.find('a').first().attr('href') || '';
          
          if (title && snippet) {
            results.push(`**${title}**\n${snippet}\nSource: ${link}`);
          }
        });
      } else {
        // Use standard selectors
        searchResults.each((i, element) => {
          if (i >= 5) return false; // Limit to 5 results
          
          const $element = $(element);
          const title = $element.find('a').first().text().trim() ||
                       $element.find('.result__title, .result-title, h3').text().trim();
          const snippet = $element.find('.result__snippet, .result-snippet, .snippet').text().trim();
          const link = $element.find('a').first().attr('href') || '';
          
          if (title && snippet) {
            results.push(`**${title}**\n${snippet}\nSource: ${link}`);
          }
        });
      }

      return results;
      
    } catch (error) {
      console.error('WebSearchService: DuckDuckGo error:', error);
      return [];
    }
  }

  private async fallbackSearch(query: string): Promise<string[]> {
    // Simple fallback - return a message indicating search limitations
    return [
      `**Search Results for "${query}"**\n` +
      `I apologize, but I'm unable to access current web search results at the moment. ` +
      `This could be due to network connectivity issues or search service restrictions. ` +
      `For the most up-to-date information about "${query}", I recommend:\n\n` +
      `1. Checking official websites directly\n` +
      `2. Using search engines like Google, Bing, or DuckDuckGo in your browser\n` +
      `3. Consulting relevant documentation or news sources\n\n` +
      `I can still help answer questions based on my existing knowledge base.`
    ];
  }

  // เพิ่มฟังก์ชันสำหรับดึงข้อมูลจากเว็บไซต์โดยตรง
  async scrapeWebContent(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.getRandomUserAgent()
        },
        timeout: 10000 // Increase timeout
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
    } catch (error) {
      console.error('WebSearchService: Web scraping error:', error);
      return '';
    }
  }
}

export const webSearchService = new WebSearchService(); 