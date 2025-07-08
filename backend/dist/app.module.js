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
const config_1 = require("@nestjs/config");
const mongoose_1 = require("@nestjs/mongoose");
const event_emitter_1 = require("@nestjs/event-emitter");
const health_module_1 = require("./infrastructure/health/health.module");
const redis_module_1 = require("./infrastructure/redis/redis.module");
const storage_module_1 = require("./infrastructure/storage/storage.module");
const queue_module_1 = require("./infrastructure/queue/queue.module");
const bedrock_module_1 = require("./infrastructure/bedrock/bedrock.module");
const ws_module_1 = require("./infrastructure/ws/ws.module");
const monitoring_module_1 = require("./infrastructure/monitoring/monitoring.module");
const security_module_1 = require("./infrastructure/security/security.module");
const auth_module_1 = require("./modules/auth/auth.module");
const user_module_1 = require("./modules/users/user.module");
const chat_module_1 = require("./modules/chat/chat.module");
const agent_module_1 = require("./modules/agents/agent.module");
const collection_module_1 = require("./modules/collection/collection.module");
const department_module_1 = require("./modules/department/department.module");
const stats_module_1 = require("./modules/stats/stats.module");
const upload_module_1 = require("./modules/upload/upload.module");
const admin_module_1 = require("./modules/admin/admin.module");
const system_prompt_module_1 = require("./modules/system-prompt/system-prompt.module");
const training_module_1 = require("./modules/training/training.module");
const embeddings_module_1 = require("./modules/embeddings/embeddings.module");
const graceful_shutdown_service_1 = require("./common/services/graceful-shutdown.service");
const global_exception_filter_1 = require("./common/filters/global-exception.filter");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: ['../.env', '.env'],
            }),
            event_emitter_1.EventEmitterModule.forRoot(),
            mongoose_1.MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/mfu_chatbot'),
            redis_module_1.RedisModule,
            storage_module_1.StorageModule,
            queue_module_1.QueueModule,
            auth_module_1.AuthModule,
            user_module_1.UserModule,
            health_module_1.HealthModule,
            chat_module_1.ChatModule,
            agent_module_1.AgentModule,
            collection_module_1.CollectionModule,
            bedrock_module_1.BedrockModule,
            ws_module_1.WsModule,
            department_module_1.DepartmentModule,
            stats_module_1.StatsModule,
            upload_module_1.UploadModule,
            admin_module_1.AdminModule,
            system_prompt_module_1.SystemPromptModule,
            training_module_1.TrainingModule,
            monitoring_module_1.MonitoringModule,
            security_module_1.SecurityModule,
            embeddings_module_1.EmbeddingsModule,
        ],
        providers: [
            graceful_shutdown_service_1.GracefulShutdownService,
            global_exception_filter_1.GlobalExceptionFilter,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map