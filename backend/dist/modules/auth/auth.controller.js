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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const user_service_1 = require("../users/user.service");
const jwt_guard_1 = require("./jwt.guard");
const refresh_token_service_1 = require("./refresh-token.service");
const zod_validation_decorator_1 = require("../../common/decorators/zod-validation.decorator");
const schemas_1 = require("../../common/schemas");
let AuthController = class AuthController {
    constructor(userService, jwtService, refreshService) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.refreshService = refreshService;
    }
    async login(body) {
        const { username, password } = body;
        const user = await this.userService.findByUsername(username);
        if (!user) {
            return { error: 'Invalid credentials' };
        }
        const valid = await user.comparePassword(password);
        if (!valid) {
            return { error: 'Invalid credentials' };
        }
        const payload = { sub: user.id, username: user.username, roles: user.roles };
        const accessToken = await this.jwtService.signAsync(payload, { expiresIn: '15m' });
        const refreshToken = await this.refreshService.create(user.id);
        return { accessToken, refreshToken, user };
    }
    async refreshToken(body) {
        const { refreshToken: token } = body;
        const result = await this.refreshService.rotate(token);
        if (!result)
            return { error: 'Invalid refresh' };
        const payload = { sub: result.userId };
        const accessToken = await this.jwtService.signAsync(payload, { expiresIn: '15m' });
        return { accessToken, refreshToken: result.token };
    }
    async me(req) {
        return req.user;
    }
    async logout() {
        return { success: true };
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, zod_validation_decorator_1.ZodValidation)(schemas_1.loginSchema),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, zod_validation_decorator_1.ZodValidation)(schemas_1.refreshTokenSchema),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refreshToken", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Get)('me'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.UseGuards)(jwt_guard_1.JwtAuthGuard),
    (0, common_1.Post)('logout'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)({
        path: 'auth',
        version: '1'
    }),
    __metadata("design:paramtypes", [user_service_1.UserService,
        jwt_1.JwtService,
        refresh_token_service_1.RefreshTokenService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map