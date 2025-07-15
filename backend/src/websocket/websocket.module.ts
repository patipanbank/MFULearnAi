import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WebSocketGateway } from './websocket.gateway';
import { WebSocketService } from './websocket.service';
import { RedisModule } from '../redis/redis.module';
import { TaskModule } from '../tasks/task.module';
import { AgentModule } from '../agent/agent.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '24h' },
    }),
    RedisModule,
    TaskModule,
    AgentModule,
    ChatModule,
  ],
  providers: [WebSocketGateway, WebSocketService],
  exports: [WebSocketGateway, WebSocketService],
})
export class WebSocketModule {} 