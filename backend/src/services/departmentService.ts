import { getDatabase } from '../lib/mongodb';

export const ensure_department_exists = async (department_name: string): Promise<void> => {
  if (!department_name) return;
  
  const db = getDatabase();
  if (!db) {
    throw new Error('Database not connected');
  }
  
  const collection = db.collection('departments');
  
  // Check if department exists
  const existing = await collection.findOne({ name: department_name.toLowerCase() });
  if (!existing) {
    // Create department if it doesn't exist
    await collection.insertOne({
      name: department_name.toLowerCase(),
      displayName: department_name,
      created: new Date(),
      updated: new Date()
    });
  }
}; 