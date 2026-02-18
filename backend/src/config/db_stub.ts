import mongoose from 'mongoose';

export const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/mful-main');
        console.log(`[MongoDB] Connected: ${conn.connection.host}`);
    } catch (error: any) {
        console.error(`[MongoDB] Error: ${error.message}`);
        process.exit(1);
    }
};
