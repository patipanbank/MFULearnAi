"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketModule = void 0;
const common_1 = require("@nestjs/common");
const websocket_gateway_1 = require("./websocket.gateway");
const websocket_service_1 = require("./websocket.service");
const redis_pubsub_service_1 = require("../redis/redis-pubsub.service");
const chat_module_1 = require("../chat/chat.module");
const agent_module_1 = require("../agent/agent.module");
const task_module_1 = require("../tasks/task.module");
const jwt_1 = require("@nestjs/jwt");
const config_module_1 = require("../config/config.module");
let WebSocketModule = class WebSocketModule {
};
exports.WebSocketModule = WebSocketModule;
exports.WebSocketModule = WebSocketModule = __decorate([
    (0, common_1.Module)({
        imports: [
            chat_module_1.ChatModule,
            agent_module_1.AgentModule,
            task_module_1.TaskModule,
            jwt_1.JwtModule,
            config_module_1.ConfigModule,
        ],
        controllers: [],
        providers: [
            websocket_gateway_1.WebSocketGateway,
            websocket_service_1.WebSocketService,
            redis_pubsub_service_1.RedisPubSubService,
        ],
        exports: [
            websocket_gateway_1.WebSocketGateway,
            websocket_service_1.WebSocketService,
            redis_pubsub_service_1.RedisPubSubService,
        ],
    })
], WebSocketModule);
//# sourceMappingURL=websocket.module.js.map