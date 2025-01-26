import axios from 'axios';
import { VectorDBService } from './vectorDB';
import { DataPreparationService } from './dataPreparation';

const OLLAMA_API = 'http://ollama:11434/api';

export class OllamaService {
  private vectorDB: VectorDBService;
  private dataPrep: DataPreparationService;

  constructor() {
    this.vectorDB = new VectorDBService();
    this.dataPrep = new DataPreparationService();
  }

  // ดึงรายการ models ที่มีในระบบ
  async getModels() {
    const response = await axios.get(`${OLLAMA_API}/tags`);
    return response.data.models;
  }

  // สร้าง collection ใหม่
  async createCollection(modelName: string, collectionName: string) {
    return await axios.post(`${OLLAMA_API}/create`, {
      name: `${modelName}-${collectionName}`,
      path: `models/${modelName}/collections/${collectionName}`
    });
  }

  // Training Pipeline
  async trainModel(file: Express.Multer.File, modelName: string, collectionName: string) {
    // 1. Data Preparation
    const rawText = await this.dataPrep.extractRawData(file);
    const extractedInfo = await this.dataPrep.extractInformation(rawText);
    const chunks = await this.dataPrep.createChunks(extractedInfo);
    const embeddings = await this.dataPrep.createEmbeddings(chunks);

    // 2. Store in Vector Database
    await this.vectorDB.addEmbeddings(collectionName, embeddings, chunks);

    return { success: true, message: 'Training completed' };
  }

  // Query Pipeline
  async query(question: string, modelName: string, collectionName: string) {
    // 1. Create embedding for question
    const questionEmbedding = await this.dataPrep.createEmbeddings([question]);

    // 2. Get relevant data from vector DB
    const relevantData = await this.vectorDB.queryRelevantData(
      collectionName,
      questionEmbedding[0]
    );

    // 3. Format context for LLM
    const context = relevantData.documents.join('\n');

    // 4. Query Ollama with context
    const response = await axios.post('http://localhost:11434/api/chat', {
      model: modelName,
      messages: [
        {
          role: 'system',
          content: `Use this context to answer the question: ${context}`
        },
        {
          role: 'user',
          content: question
        }
      ]
    });

    return response.data;
  }

  async chat(prompt: string, modelName: string) {
    try {
      const response = await axios.post(`${OLLAMA_API}/generate`, {
        model: modelName,
        prompt,
        options: {
          num_ctx: 2048,         // ลดขนาด context
          num_thread: 4,         // ปรับจำนวน threads ตาม CPU
          temperature: 0.7,      // ปรับความสร้างสรรค์
          top_k: 40,            // จำกัดตัวเลือกคำตอบ
          top_p: 0.9,           // จำกัดความหลากหลาย
        }
      });
      return response.data;
    } catch (error) {
      console.error('Ollama chat error:', error);
      throw error;
    }
  }

  async streamChat(prompt: string, modelName: string, onToken: (token: string) => void) {
    try {
      const response = await axios.post(`${OLLAMA_API}/generate`, {
        model: modelName,
        prompt,
        stream: true
      }, {
        responseType: 'stream'
      });

      response.data.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        try {
          const json = JSON.parse(text);
          if (json.response) {
            onToken(json.response);
          }
        } catch (e) {
          console.error('Error parsing stream chunk:', e);
        }
      });

    } catch (error) {
      console.error('Ollama stream chat error:', error);
      throw error;
    }
  }
} 