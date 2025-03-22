import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

interface EmbeddingCacheEntry {
  embedding: number[];
  timestamp: number;
}

export class TitanImageEmbedService {
  private client: BedrockRuntimeClient;
  private readonly MODEL_ID = 'amazon.titan-embed-image-v1';
  private cache: Map<string, EmbeddingCacheEntry>;
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 ชั่วโมง
  private readonly MAX_CACHE_SIZE = 1000;

  constructor() {
    this.client = new BedrockRuntimeClient({
      region: process.env.AWS_REGION || 'ap-southeast-1'
    });

    this.cache = new Map<string, EmbeddingCacheEntry>();
  }

  /**
   * สร้าง embedding สำหรับรูปภาพที่กำหนด
   * @param imageBase64 ข้อมูลรูปภาพในรูปแบบ base64
   * @param contextText ข้อความบริบทเพิ่มเติม (optional)
   * @returns embedding vector
   */
  async embedImage(imageBase64: string, contextText?: string): Promise<number[]> {
    try {
      // สร้าง hash key จากข้อมูลรูปภาพเพื่อใช้ในการ cache
      const cacheKey = this.hashString(imageBase64 + (contextText || ''));
      
      // ตรวจสอบ cache
      const cachedEntry = this.cache.get(cacheKey);
      if (cachedEntry && Date.now() - cachedEntry.timestamp < this.CACHE_TTL) {
        // console.log('Using in-memory cache for image embedding');
        return cachedEntry.embedding;
      }
      
      // สร้าง payload สำหรับ API
      const payload: any = {
        inputImage: {
          base64: imageBase64
        }
      };
      
      // เพิ่มบริบทข้อความถ้ามี
      if (contextText) {
        payload.inputText = contextText;
      }
      
      // สร้าง command สำหรับเรียก Bedrock API
      const command = new InvokeModelCommand({
        modelId: this.MODEL_ID,
        contentType: 'application/json',
        accept: '*/*',
        body: JSON.stringify(payload)
      });
      
      // เรียก API และรับผลลัพธ์
      const response = await this.client.send(command);
      
      // แปลงผลลัพธ์
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const embedding = responseBody.embedding;
      
      // จำกัดขนาด cache
      if (this.cache.size >= this.MAX_CACHE_SIZE) {
        // ลบรายการแรกออกถ้า cache เต็ม
        const firstKey = this.cache.keys().next().value;
        if (firstKey) {
          this.cache.delete(firstKey);
        }
      }
      
      // บันทึกใน cache
      this.cache.set(cacheKey, {
        embedding,
        timestamp: Date.now()
      });
      
      return embedding;
    } catch (error) {
      console.error('Error creating image embedding:', error);
      throw new Error('Failed to create image embedding');
    }
  }
  
  /**
   * สร้าง hash จากสตริง
   * @param str สตริงที่ต้องการแปลงเป็น hash
   * @returns hash ในรูปแบบสตริง
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // แปลงเป็น 32bit integer
    }
    return hash.toString();
  }
}

export const titanImageEmbedService = new TitanImageEmbedService(); 