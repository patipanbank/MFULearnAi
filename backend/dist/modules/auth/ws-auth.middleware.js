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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsAuthMiddleware = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const user_service_1 = require("../users/user.service");
let WsAuthMiddleware = class WsAuthMiddleware {
    constructor(jwtService, userService) {
        this.jwtService = jwtService;
        this.userService = userService;
    }
    createMiddleware() {
        return async (socket, next) => {
            var _a, _b;
            try {
                const token = ((_a = socket.handshake.auth) === null || _a === void 0 ? void 0 : _a.token) || ((_b = socket.handshake.query) === null || _b === void 0 ? void 0 : _b.token);
                if (!token) {
                    throw new Error('Authentication token is missing');
                }
                const payload = await this.jwtService.verifyAsync(token, {
                    secret: process.env.JWT_SECRET,
                });
                if (!payload || !payload.sub) {
                    throw new Error('Invalid token payload');
                }
                const user = await this.userService.findByUsername(payload.username);
                if (!user) {
                    throw new Error('User not found');
                }
                socket.data.user = user;
                socket.data.userId = user.id;
                socket.data.username = user.username;
                console.log(`✅ WebSocket authenticated for user: ${user.username} (${user.id})`);
                next();
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`❌ WebSocket authentication failed:`, errorMessage);
                next(new Error('Authentication failed'));
            }
        };
    }
};
exports.WsAuthMiddleware = WsAuthMiddleware;
exports.WsAuthMiddleware = WsAuthMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        user_service_1.UserService])
], WsAuthMiddleware);
//# sourceMappingURL=ws-auth.middleware.js.map