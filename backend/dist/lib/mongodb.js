"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDB = exports.getDatabase = exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config/config");
let isConnected = false;
const connectDB = async () => {
    if (isConnected) {
        console.log('MongoDB already connected');
        return;
    }
    try {
        const uri = config_1.config.mongoUri || '';
        if (!uri)
            throw new Error('MongoDB URI is not defined');
        await mongoose_1.default.connect(uri);
        isConnected = true;
        console.log('MongoDB connected successfully');
    }
    catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
const getDatabase = () => {
    return mongoose_1.default.connection.db;
};
exports.getDatabase = getDatabase;
const disconnectDB = async () => {
    if (isConnected) {
        await mongoose_1.default.disconnect();
        isConnected = false;
        console.log('MongoDB disconnected');
    }
};
exports.disconnectDB = disconnectDB;
//# sourceMappingURL=mongodb.js.map