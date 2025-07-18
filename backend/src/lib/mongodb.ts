import mongoose from 'mongoose';
import { config } from '../config/config';

let isConnected = false;

export const connectDB = async (): Promise<void> => {
  if (isConnected) {
    console.log('MongoDB already connected');
    return;
  }

  try {
    const uri = config.mongoUri || '';
    if (!uri) throw new Error('MongoDB URI is not defined');
    await mongoose.connect(uri);
    isConnected = true;
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

export const getDatabase = () => {
  return mongoose.connection.db;
};

export const disconnectDB = async (): Promise<void> => {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('MongoDB disconnected');
  }
}; 