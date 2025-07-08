"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshTokenSchema = void 0;
const mongoose_1 = require("mongoose");
exports.RefreshTokenSchema = new mongoose_1.Schema({
    userId: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
});
//# sourceMappingURL=refresh-token.schema.js.map