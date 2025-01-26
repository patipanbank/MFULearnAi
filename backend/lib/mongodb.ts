import mongoose from 'mongoose';
import dotenv from 'dotenv';

// เพิ่มบรรทัดนี้เพื่อโหลด .env
dotenv.config();

const connectDB = async () => {
  try {
    // แก้ไข URI ให้ตรงกับชื่อ service และ credentials ใน docker-compose
    const URI = process.env.MONGODB_URI || 'mongodb://root:1234@db:27017/mfulearnai?authSource=admin';
    
    await mongoose.connect(URI);
    console.log('MongoDB Connected:', mongoose.connection.name);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

// Add connection error handler
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

export default connectDB; 