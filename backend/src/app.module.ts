import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { WebSocketModule } from './websocket/websocket.module';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { AgentModule } from './agent/agent.module';
import { TrainingModule } from './training/training.module';
import { StatsModule } from './stats/stats.module';
import { UploadModule } from './upload/upload.module';
import { DepartmentModule } from './department/department.module';
import { BedrockModule } from './bedrock/bedrock.module';
import { TaskModule } from './tasks/task.module';
import { LangChainModule } from './langchain/langchain.module';
import { CollectionModule } from './collection/collection.module';
import { EmbeddingModule } from './embedding/embedding.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RedisModule,
    TaskModule,
    WebSocketModule,
    AuthModule,
    ChatModule,
    AgentModule,
    TrainingModule,
    StatsModule,
    UploadModule,
    DepartmentModule,
    BedrockModule,
    LangChainModule,
    CollectionModule,
    EmbeddingModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
