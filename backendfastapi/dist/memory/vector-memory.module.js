"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VectorMemoryModule = void 0;
const common_1 = require("@nestjs/common");
const vector_memory_service_1 = require("./vector-memory.service");
const langchain_redis_history_service_1 = require("./langchain-redis-history.service");
const smart_memory_manager_service_1 = require("./smart-memory-manager.service");
let VectorMemoryModule = class VectorMemoryModule {
};
exports.VectorMemoryModule = VectorMemoryModule;
exports.VectorMemoryModule = VectorMemoryModule = __decorate([
    (0, common_1.Module)({
        providers: [
            vector_memory_service_1.VectorMemoryService,
            langchain_redis_history_service_1.LangChainRedisHistoryService,
            smart_memory_manager_service_1.SmartMemoryManagerService,
        ],
        exports: [
            vector_memory_service_1.VectorMemoryService,
            langchain_redis_history_service_1.LangChainRedisHistoryService,
            smart_memory_manager_service_1.SmartMemoryManagerService,
        ],
    })
], VectorMemoryModule);
//# sourceMappingURL=vector-memory.module.js.map