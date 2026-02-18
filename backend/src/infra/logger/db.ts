import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGO_URI_LOGS = process.env.MONGO_URI_LOGS || 'mongodb://localhost:27017/mful-logs';

export const logConnection = mongoose.createConnection(MONGO_URI_LOGS);

logConnection.on('connected', () => {
    console.log(`[Logger] Connected to MongoDB Logs (${MONGO_URI_LOGS})`);
});

logConnection.on('error', (err) => {
    console.error('[Logger] MongoDB Logs connection error:', err);
});
