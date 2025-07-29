"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
exports.getConnection = getConnection;
const mongoose_1 = __importDefault(require("mongoose"));
async function connectDB() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mfulearnai';
        await mongoose_1.default.connect(mongoUri, {
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        mongoose_1.default.connection.on('connected', () => {
            console.log('✅ Connected to MongoDB');
        });
        mongoose_1.default.connection.on('error', (error) => {
            console.error('❌ MongoDB connection error:', error);
        });
        mongoose_1.default.connection.on('disconnected', () => {
            console.log('🔌 MongoDB disconnected');
        });
    }
    catch (error) {
        console.error('❌ Failed to connect to MongoDB:', error);
        throw error;
    }
}
async function disconnectDB() {
    try {
        await mongoose_1.default.disconnect();
        console.log('✅ Disconnected from MongoDB');
    }
    catch (error) {
        console.error('❌ Error disconnecting from MongoDB:', error);
        throw error;
    }
}
function getConnection() {
    return mongoose_1.default.connection;
}
//# sourceMappingURL=mongodb.js.map