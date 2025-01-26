import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import KnowledgeBase from '../models/KnowledgeBase';

// ติดตั้ง package เพิ่มเติม
// npm install @langchain/community@latest

export class DataProcessor {
  static async extractText(file: Express.Multer.File): Promise<string> {
    // ตรวจสอบประเภทไฟล์และแปลงเป็นข้อความ
    const fileType = file.mimetype;
    let text = '';

    switch(fileType) {
      case 'text/plain':
        text = file.buffer.toString('utf-8');
        break;
      // เพิ่มการรองรับไฟล์ประเภทอื่นๆ ตามต้องการ
      default:
        throw new Error('Unsupported file type');
    }

    return text;
  }

  static async splitIntoChunks(text: string): Promise<Document[]> {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    return await splitter.createDocuments([text]);
  }

  static async createEmbeddings(documents: Document[], knowledgeBaseId: string): Promise<Document[]> {
    const kb = await KnowledgeBase.findById(knowledgeBaseId).populate('baseModelId');
    if (!kb) {
      throw new Error('Knowledge base not found');
    }

    const model = kb.baseModelId as any;
    
    const embeddings = new OllamaEmbeddings({
      model: model.modelType,
      baseUrl: "http://ollama:11434"
    });

    for (const doc of documents) {
      const [embedding] = await embeddings.embedDocuments([doc.pageContent]);
      doc.metadata.embedding = embedding;
    }

    return documents;
  }
} 