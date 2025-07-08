"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const ws_gateway_1 = require("./ws.gateway");
const ws_auth_middleware_1 = require("../../modules/auth/ws-auth.middleware");
const jwt_ws_guard_1 = require("../../modules/auth/jwt-ws.guard");
const user_module_1 = require("../../modules/users/user.module");
const redis_module_1 = require("../redis/redis.module");
let WsModule = class WsModule {
};
exports.WsModule = WsModule;
exports.WsModule = WsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            user_module_1.UserModule,
            redis_module_1.RedisModule,
            jwt_1.JwtModule.register({
                secret: process.env.JWT_SECRET || 'default-secret',
                signOptions: { expiresIn: '1h' },
            }),
        ],
        providers: [
            ws_gateway_1.WsGateway,
            ws_auth_middleware_1.WsAuthMiddleware,
            jwt_ws_guard_1.JwtWsGuard,
        ],
        exports: [
            ws_gateway_1.WsGateway,
            ws_auth_middleware_1.WsAuthMiddleware,
            jwt_ws_guard_1.JwtWsGuard,
        ],
    })
], WsModule);
//# sourceMappingURL=ws.module.js.map