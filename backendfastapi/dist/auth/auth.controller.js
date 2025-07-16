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
const auth_service_1 = require("./auth.service");
const saml_service_1 = require("./saml.service");
const jwt_auth_guard_1 = require("./guards/jwt-auth.guard");
const local_auth_guard_1 = require("./guards/local-auth.guard");
const get_user_decorator_1 = require("./decorators/get-user.decorator");
let AuthController = class AuthController {
    authService;
    samlService;
    constructor(authService, samlService) {
        this.authService = authService;
        this.samlService = samlService;
    }
    async samlLogin(req, res) {
        try {
            const loginUrl = await this.samlService.getLoginUrl();
            res.redirect(loginUrl);
        }
        catch (error) {
            throw new common_1.HttpException('SAML login failed', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async samlCallback(req, res) {
        try {
            const result = await this.samlService.processCallback(req);
            if (result.success) {
                const token = await this.authService.createJwtToken(result.user);
                const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}`;
                res.redirect(redirectUrl);
            }
            else {
                throw new common_1.HttpException('SAML authentication failed', common_1.HttpStatus.UNAUTHORIZED);
            }
        }
        catch (error) {
            console.error('SAML callback error:', error);
            const errorUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error`;
            res.redirect(errorUrl);
        }
    }
    async samlMetadata(res) {
        try {
            const metadata = await this.samlService.getMetadata();
            res.set('Content-Type', 'text/xml');
            res.send(metadata);
        }
        catch (error) {
            throw new common_1.HttpException('Failed to generate SAML metadata', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async login(req) {
        return this.authService.login(req.user);
    }
    async getProfile(user) {
        return this.authService.getUserById(user.id);
    }
    async logout(req, res) {
        res.json({ message: 'Logged out successfully' });
    }
    async refreshToken(req) {
        return this.authService.refreshToken(req.user);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Get)('saml/login'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "samlLogin", null);
__decorate([
    (0, common_1.Post)('saml/callback'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "samlCallback", null);
__decorate([
    (0, common_1.Get)('saml/metadata'),
    __param(0, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "samlMetadata", null);
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.UseGuards)(local_auth_guard_1.LocalAuthGuard),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, get_user_decorator_1.GetUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getProfile", null);
__decorate([
    (0, common_1.Get)('logout'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('refresh'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refreshToken", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        saml_service_1.SAMLService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map