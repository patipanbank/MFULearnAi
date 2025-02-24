"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
// เพิ่มบรรทัดนี้เพื่อโหลด .env
dotenv_1.default.config();
// เพิ่ม default URI
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mfu_chatbot';
const connectDB = async () => {
    try {
        const conn = await mongoose_1.default.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    }
    catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
// Add connection error handler
mongoose_1.default.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});
