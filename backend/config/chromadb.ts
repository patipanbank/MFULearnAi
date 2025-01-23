import { ChromaClient } from 'chromadb';

export const initChroma = async () => {
  const client = new ChromaClient({
    path: 'http://chromadb:8000'  // เปลี่ยนจาก default localhost
  });

  try {
    const collection = await client.getOrCreateCollection({
      name: "mfu-knowledge",
      metadata: { "description": "MFU knowledge base" }
    });
    
    return collection;
  } catch (error) {
    console.error('ChromaDB initialization error:', error);
    throw error;
  }
}; 