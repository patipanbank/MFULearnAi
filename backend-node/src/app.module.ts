import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
// Infrastructure modules
import { HealthModule } from './infrastructure/health/health.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { StorageModule } from './infrastructure/storage/storage.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { BedrockModule } from './infrastructure/bedrock/bedrock.module';
import { WsModule } from './infrastructure/ws/ws.module';
import { MonitoringModule } from './infrastructure/monitoring/monitoring.module';
import { SecurityModule } from './infrastructure/security/security.module';

// Business modules
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/users/user.module';
import { ChatModule } from './modules/chat/chat.module';
import { AgentModule } from './modules/agents/agent.module';
import { CollectionModule } from './modules/collection/collection.module';
import { DepartmentModule } from './modules/department/department.module';
import { StatsModule } from './modules/stats/stats.module';
import { UploadModule } from './modules/upload/upload.module';
import { AdminModule } from './modules/admin/admin.module';
import { SystemPromptModule } from './modules/system-prompt/system-prompt.module';
import { TrainingModule } from './modules/training/training.module';
import { EmbeddingsModule } from './modules/embeddings/embeddings.module';

// Common utilities
import { AppLogger } from './common/logger.service';
import { GracefulShutdownService } from './common/services/graceful-shutdown.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
    }),
    EventEmitterModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/mfu_chatbot'),
    RedisModule,
    StorageModule,
    QueueModule,
    AuthModule,
    UserModule,
    HealthModule,
    ChatModule,
    AgentModule,
    CollectionModule,
    BedrockModule,
    WsModule,
    DepartmentModule,
    StatsModule,
    UploadModule,
    AdminModule,
    SystemPromptModule,
    TrainingModule,
    MonitoringModule,
    SecurityModule,
    EmbeddingsModule,
  ],
  providers: [
    GracefulShutdownService,
    GlobalExceptionFilter,
  ],
})
export class AppModule {} 