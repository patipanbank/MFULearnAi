"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefreshTokenService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const crypto_1 = require("crypto");
let RefreshTokenService = class RefreshTokenService {
    constructor(model) {
        this.model = model;
        this.ttlDays = 7;
    }
    async create(userId) {
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        const expiresAt = new Date(Date.now() + this.ttlDays * 24 * 60 * 60 * 1000);
        await this.model.create({ userId, token, expiresAt });
        return token;
    }
    async verify(token) {
        const doc = await this.model.findOne({ token });
        if (!doc)
            return null;
        if (doc.expiresAt < new Date()) {
            await doc.deleteOne();
            return null;
        }
        return doc.userId;
    }
    async rotate(oldToken) {
        const userId = await this.verify(oldToken);
        if (!userId)
            return null;
        await this.model.deleteOne({ token: oldToken });
        const newToken = await this.create(userId);
        return { userId, token: newToken };
    }
};
exports.RefreshTokenService = RefreshTokenService;
exports.RefreshTokenService = RefreshTokenService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)('RefreshToken')),
    __metadata("design:paramtypes", [mongoose_2.Model])
], RefreshTokenService);
//# sourceMappingURL=refresh-token.service.js.map