import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/mful-chat';
const ENV_TYPE = (process.env.ENV_TYPE || 'TEST') as 'TEST' | 'PROD';

export const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log(`[MongoDB] Connected (${ENV_TYPE})`);
    } catch (err) {
        console.error('[MongoDB] Connection error:', err);
        process.exit(1);
    }
};
