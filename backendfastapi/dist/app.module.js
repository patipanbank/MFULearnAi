"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const config_module_1 = require("./config/config.module");
const database_module_1 = require("./database/database.module");
const redis_module_1 = require("./redis/redis.module");
const websocket_module_1 = require("./websocket/websocket.module");
const auth_module_1 = require("./auth/auth.module");
const chat_module_1 = require("./chat/chat.module");
const agent_module_1 = require("./agent/agent.module");
const training_module_1 = require("./training/training.module");
const stats_module_1 = require("./stats/stats.module");
const upload_module_1 = require("./upload/upload.module");
const department_module_1 = require("./department/department.module");
const bedrock_module_1 = require("./bedrock/bedrock.module");
const task_module_1 = require("./tasks/task.module");
const langchain_module_1 = require("./langchain/langchain.module");
const collection_module_1 = require("./collection/collection.module");
const embedding_module_1 = require("./embedding/embedding.module");
const admin_module_1 = require("./admin/admin.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_module_1.ConfigModule,
            database_module_1.DatabaseModule,
            redis_module_1.RedisModule,
            task_module_1.TaskModule,
            websocket_module_1.WebSocketModule,
            auth_module_1.AuthModule,
            chat_module_1.ChatModule,
            agent_module_1.AgentModule,
            training_module_1.TrainingModule,
            stats_module_1.StatsModule,
            upload_module_1.UploadModule,
            department_module_1.DepartmentModule,
            bedrock_module_1.BedrockModule,
            langchain_module_1.LangChainModule,
            collection_module_1.CollectionModule,
            embedding_module_1.EmbeddingModule,
            admin_module_1.AdminModule,
        ],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map