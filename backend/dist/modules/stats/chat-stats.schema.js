"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatStatsSchema = void 0;
const mongoose_1 = require("mongoose");
exports.ChatStatsSchema = new mongoose_1.Schema({
    date: { type: Date, required: true, unique: true },
    uniqueUsers: [{ type: String }],
    totalChats: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
});
//# sourceMappingURL=chat-stats.schema.js.map