import { Module } from '@nestjs/common';
import { WebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';
import { RedisModule } from '../redis/redis.module';
import { ChatModule } from '../chat/chat.module';
import { AgentModule } from '../agent/agent.module';
import { TaskModule } from '../tasks/task.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '../config/config.module';

@Module({
  imports: [
    RedisModule,
    ChatModule,
    AgentModule,
    TaskModule,
    JwtModule,
    ConfigModule,
  ],
  controllers: [],
  providers: [
    WebSocketGateway,
    WebSocketService,
  ],
  exports: [
    WebSocketGateway,
    WebSocketService,
  ],
})
export class WebSocketModule {} 