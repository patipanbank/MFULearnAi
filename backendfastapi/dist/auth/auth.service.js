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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const user_model_1 = require("../models/user.model");
const config_service_1 = require("../config/config.service");
const bcrypt = require("bcryptjs");
let AuthService = class AuthService {
    userModel;
    jwtService;
    configService;
    constructor(userModel, jwtService, configService) {
        this.userModel = userModel;
        this.jwtService = jwtService;
        this.configService = configService;
    }
    async validateUser(username, password) {
        const user = await this.userModel.findOne({ username }).select('+password');
        if (user && user.password && await this.comparePasswords(password, user.password)) {
            const { password, ...result } = user.toObject();
            return result;
        }
        return null;
    }
    async login(user) {
        const payload = {
            sub: user.id,
            nameID: user.nameID,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            department: user.department,
            groups: user.groups,
        };
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id: user.id,
                nameID: user.nameID,
                username: user.username,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role,
                department: user.department,
                groups: user.groups,
            },
        };
    }
    async createJwtToken(user) {
        const payload = {
            sub: user.id,
            nameID: user.nameID,
            username: user.username,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            department: user.department,
            groups: user.groups,
        };
        return this.jwtService.sign(payload);
    }
    async getUserById(userId) {
        return this.userModel.findById(userId).exec();
    }
    async getUserByUsername(username) {
        return this.userModel.findOne({ username }).exec();
    }
    async getUserByNameID(nameID) {
        return this.userModel.findOne({ nameID }).exec();
    }
    async createUser(userData) {
        if (userData.password) {
            userData.password = await bcrypt.hash(userData.password, 10);
        }
        const user = new this.userModel(userData);
        return user.save();
    }
    async updateUser(userId, updateData) {
        if (updateData.password) {
            updateData.password = await bcrypt.hash(updateData.password, 10);
        }
        return this.userModel.findByIdAndUpdate(userId, updateData, { new: true }).exec();
    }
    async refreshToken(user) {
        return this.login(user);
    }
    async comparePasswords(plainPassword, hashedPassword) {
        return bcrypt.compare(plainPassword, hashedPassword);
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectModel)(user_model_1.User.name)),
    __metadata("design:paramtypes", [mongoose_2.Model,
        jwt_1.JwtService,
        config_service_1.ConfigService])
], AuthService);
//# sourceMappingURL=auth.service.js.map