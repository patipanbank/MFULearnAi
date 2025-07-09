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
exports.SamlController = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const user_service_1 = require("../users/user.service");
const passport_1 = require("@nestjs/passport");
const saml_strategy_1 = require("./saml.strategy");
let SamlController = class SamlController {
    constructor(userService, jwtService, samlStrategy) {
        this.userService = userService;
        this.jwtService = jwtService;
        this.samlStrategy = samlStrategy;
    }
    async samlLogin() {
    }
    async samlLogout(req) {
        return this.samlStrategy.logout(req, (err, url) => url);
    }
    async samlLogoutCallback() {
        return { success: true };
    }
    async samlCallback(req, res) {
        try {
            const samlUser = req.user;
            console.log('SAML callback received user:', samlUser);
            if (!samlUser || !samlUser.nameID) {
                console.error('SAML callback: Missing user or nameID');
                return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=saml_auth_failed`);
            }
            let user = await this.userService.findByUsername(samlUser.nameID);
            if (!user) {
                user = await this.userService.createUser(samlUser.nameID, samlUser.nameID);
                console.log('Created new user from SAML:', user);
            }
            const payload = { sub: user.id, username: user.username, roles: user.roles };
            const token = await this.jwtService.signAsync(payload);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.redirect(`${frontendUrl}/auth/callback?token=${token}`);
        }
        catch (error) {
            console.error('SAML callback error:', error);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.redirect(`${frontendUrl}/login?error=saml_callback_failed`);
        }
    }
    async metadata(res) {
        try {
            const strategy = this.samlStrategy;
            res.type('application/xml');
            res.send(strategy.generateServiceProviderMetadata(null, null));
        }
        catch (error) {
            console.error('Error generating SAML metadata:', error);
            res.status(500).send('Error generating metadata');
        }
    }
};
exports.SamlController = SamlController;
__decorate([
    (0, common_1.Get)('login/saml'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('saml')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SamlController.prototype, "samlLogin", null);
__decorate([
    (0, common_1.Get)('logout/saml'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('saml')),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SamlController.prototype, "samlLogout", null);
__decorate([
    (0, common_1.Get)('logout/saml/callback'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SamlController.prototype, "samlLogoutCallback", null);
__decorate([
    (0, common_1.Post)('saml/callback'),
    (0, common_1.Get)('saml/callback'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('saml')),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Response)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SamlController.prototype, "samlCallback", null);
__decorate([
    (0, common_1.Get)('metadata'),
    __param(0, (0, common_1.Response)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SamlController.prototype, "metadata", null);
exports.SamlController = SamlController = __decorate([
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [user_service_1.UserService,
        jwt_1.JwtService,
        saml_strategy_1.SamlStrategy])
], SamlController);
//# sourceMappingURL=saml.controller.js.map