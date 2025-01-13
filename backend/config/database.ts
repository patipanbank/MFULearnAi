import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI!, {
      // เพิ่ม options สำหรับการเชื่อมต่อ
      serverSelectionTimeoutMS: 20000, // เพิ่มเวลา timeout เป็น 20 วินาที
      socketTimeoutMS: 45000, // เพิ่ม socket timeout
      maxPoolSize: 50, // เพิ่มจำนวน connections สูงสุด
      wtimeoutMS: 2500,
      maxIdleTimeMS: 120000, // เพิ่มเวลา idle สูงสุด
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

// เพิ่ม event handlers สำหรับ connection
mongoose.connection.on('connecting', () => {
  console.log('Connecting to MongoDB...');
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected!');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected!');
});

export default connectDB; 