export async function createEmbedding(text: string) {
  // ส่งข้อความไปยัง Ollama API เพื่อสร้าง embedding
  try {
    // TODO: เพิ่มการเชื่อมต่อกับ Ollama API
    return [];
  } catch (error) {
    console.error('Error creating embedding:', error);
    throw error;
  }
} 