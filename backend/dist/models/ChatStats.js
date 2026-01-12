"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatStats = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const chatStatsSchema = new mongoose_1.default.Schema({
    date: {
        type: Date,
        required: true,
        unique: true
    },
    uniqueUsers: [{
            type: String
        }],
    totalChats: {
        type: Number,
        default: 0
    },
    totalTokens: {
        type: Number,
        default: 0
    }
});
exports.ChatStats = mongoose_1.default.model('ChatStats', chatStatsSchema);
