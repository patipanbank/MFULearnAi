import mongoose from 'mongoose';
import dotenv from 'dotenv';

// เพิ่มบรรทัดนี้เพื่อโหลด .env
dotenv.config();

// เพิ่ม default URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mfu_chatbot';

export const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI as string);
    
    // สร้าง vector index
    await conn.connection.collection('trainingdata').createIndex(
      { embedding: "2dsphere" },
      { 
        name: "embedding_vector_index",
        background: true 
      }
    );

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

// Add connection error handler
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
}); 