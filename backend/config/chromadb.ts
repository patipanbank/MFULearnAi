import { ChromaClient } from 'chromadb';

export const initChroma = async () => {
  const client = new ChromaClient();
  // สร้าง collection สำหรับเก็บข้อมูล MFU
  const collection = await client.createCollection({
    name: "mfu-knowledge",
    metadata: { "description": "MFU knowledge base" }
  });
  
  return collection;
}; 