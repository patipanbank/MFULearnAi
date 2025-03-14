import axios from 'axios';
import * as cheerio from 'cheerio';

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  date?: string;
}

class SearchService {
  private readonly userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36'
  ];

  private getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  async search(query: string, language: string = 'th'): Promise<SearchResult[]> {
    try {
      // สร้าง URL สำหรับการค้นหา
      const encodedQuery = encodeURIComponent(query);
      const searchUrl = `https://www.google.com/search?q=${encodedQuery}&hl=${language}&gl=${language === 'th' ? 'th' : 'us'}`;

      // ส่งคำขอ HTTP
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
          'Accept-Language': language === 'th' ? 'th-TH,th;q=0.9,en-US;q=0.8,en;q=0.7' : 'en-US,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml,application/xml'
        },
        timeout: 10000  // 10 วินาที
      });

      // ใช้ cheerio เพื่อแยกวิเคราะห์ HTML
      const $ = cheerio.load(response.data);
      const results: SearchResult[] = [];

      // แยกวิเคราะห์ผลการค้นหาจาก Google
      $('.g').each((i, element) => {
        if (i < 5) { // รับผลลัพธ์ 5 รายการแรก
          const titleElement = $(element).find('h3').first();
          const urlElement = $(element).find('a').first();
          const snippetElement = $(element).find('.VwiC3b').first();
          const dateElement = $(element).find('.MUxGbd.wuQ4Ob.WZ8Tjf').first();

          if (titleElement.length && urlElement.length) {
            const title = titleElement.text();
            const url = urlElement.attr('href')?.startsWith('/url?q=') 
              ? decodeURIComponent(urlElement.attr('href')!.replace('/url?q=', '').split('&')[0])
              : urlElement.attr('href');
            const snippet = snippetElement.text();
            const date = dateElement.text();

            if (title && url) {
              results.push({
                title,
                url: url.startsWith('http') ? url : `https://google.com${url}`,
                snippet: snippet || 'ไม่มีข้อความตัวอย่าง',
                date
              });
            }
          }
        }
      });

      return results;
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการค้นหา:', error);
      return [];
    }
  }

  async fetchContentFromUrl(url: string): Promise<string> {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.getRandomUserAgent()
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      
      // ลบองค์ประกอบที่ไม่จำเป็น
      $('script, style, noscript, iframe, img, svg, nav, footer, header, aside').remove();
      
      // ดึงเนื้อหาที่สำคัญ
      const title = $('title').text().trim();
      const mainContent = $('main, #content, .content, article, .article, .post, .post-content').text() || $('body').text();
      
      // ทำความสะอาดเนื้อหา
      const cleanContent = mainContent
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();
      
      return `${title}\n\n${cleanContent.substring(0, 2000)}...`;
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการดึงเนื้อหาจาก URL:', error);
      return 'ไม่สามารถดึงเนื้อหาจาก URL นี้ได้';
    }
  }

  async searchAndFetchContent(query: string, language: string = 'th'): Promise<string> {
    const searchResults = await this.search(query, language);
    if (searchResults.length === 0) {
      return 'ไม่พบผลลัพธ์สำหรับการค้นหานี้';
    }

    let resultContent = `ผลการค้นหาสำหรับ "${query}":\n\n`;
    
    // เพิ่มข้อมูลสรุปจากผลการค้นหาทั้งหมด
    searchResults.forEach((result, index) => {
      resultContent += `${index + 1}. ${result.title}\n   ${result.url}\n   ${result.snippet}\n\n`;
    });

    // ดึงข้อมูลเพิ่มเติมจาก URL แรก
    try {
      const topResultContent = await this.fetchContentFromUrl(searchResults[0].url);
      resultContent += `\nเนื้อหาเพิ่มเติมจาก ${searchResults[0].title}:\n${topResultContent}`;
    } catch (error) {
      resultContent += `\nไม่สามารถดึงเนื้อหาเพิ่มเติมได้: ${error}`;
    }

    return resultContent;
  }
}

export const searchService = new SearchService(); 