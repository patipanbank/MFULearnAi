"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatModule = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const chat_controller_1 = require("./chat.controller");
const chat_service_1 = require("./chat.service");
const chat_history_service_1 = require("./chat-history.service");
const chat_memory_service_1 = require("./chat-memory.service");
const memory_tool_service_1 = require("./memory-tool.service");
const chat_model_1 = require("../models/chat.model");
const user_model_1 = require("../models/user.model");
const redis_module_1 = require("../redis/redis.module");
const vector_memory_module_1 = require("../memory/vector-memory.module");
const langchain_module_1 = require("../langchain/langchain.module");
const collection_module_1 = require("../collection/collection.module");
const bedrock_module_1 = require("../bedrock/bedrock.module");
const config_module_1 = require("../config/config.module");
let ChatModule = class ChatModule {
};
exports.ChatModule = ChatModule;
exports.ChatModule = ChatModule = __decorate([
    (0, common_1.Module)({
        imports: [
            mongoose_1.MongooseModule.forFeature([
                { name: chat_model_1.Chat.name, schema: chat_model_1.ChatSchema },
                { name: user_model_1.User.name, schema: user_model_1.UserSchema },
            ]),
            redis_module_1.RedisModule,
            vector_memory_module_1.VectorMemoryModule,
            (0, common_1.forwardRef)(() => langchain_module_1.LangChainModule),
            collection_module_1.CollectionModule,
            bedrock_module_1.BedrockModule,
            config_module_1.ConfigModule,
        ],
        controllers: [chat_controller_1.ChatController],
        providers: [
            chat_service_1.ChatService,
            chat_history_service_1.ChatHistoryService,
            chat_memory_service_1.ChatMemoryService,
            memory_tool_service_1.MemoryToolService,
        ],
        exports: [
            chat_service_1.ChatService,
            chat_history_service_1.ChatHistoryService,
            chat_memory_service_1.ChatMemoryService,
            memory_tool_service_1.MemoryToolService,
        ],
    })
], ChatModule);
//# sourceMappingURL=chat.module.js.map