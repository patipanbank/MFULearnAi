import axios from 'axios';

const OLLAMA_API = 'http://ollama:11434/api';

export class OllamaManager {
  // ดึงรายการ models ที่มีในระบบ
  async listModels() {
    try {
      const response = await axios.get(`${OLLAMA_API}/tags`);
      return response.data.models;
    } catch (error) {
      console.error('Error listing models:', error);
      throw error;
    }
  }

  // ดาวน์โหลด model ใหม่
  async pullModel(modelName: string) {
    try {
      await axios.post(`${OLLAMA_API}/pull`, {
        name: modelName
      });
      return { success: true, message: `Model ${modelName} pulled successfully` };
    } catch (error) {
      console.error(`Error pulling model ${modelName}:`, error);
      throw error;
    }
  }

  // ตรวจสอบสถานะของ model
  async checkModelStatus(modelName: string) {
    try {
      const models = await this.listModels();
      return models.some((model: any) => model.name === modelName);
    } catch (error) {
      console.error(`Error checking model ${modelName} status:`, error);
      throw error;
    }
  }

  // ลบ model
  async deleteModel(modelName: string) {
    try {
      await axios.delete(`${OLLAMA_API}/delete`, {
        data: { name: modelName }
      });
      return { success: true, message: `Model ${modelName} deleted successfully` };
    } catch (error) {
      console.error(`Error deleting model ${modelName}:`, error);
      throw error;
    }
  }
} 