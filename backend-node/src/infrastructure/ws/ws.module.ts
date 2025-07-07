import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { WsGateway } from './ws.gateway';
import { WsAuthMiddleware } from '../../modules/auth/ws-auth.middleware';
import { JwtWsGuard } from '../../modules/auth/jwt-ws.guard';
import { UserModule } from '../../modules/users/user.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    UserModule,
    RedisModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'default-secret',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  providers: [
    WsGateway,
    WsAuthMiddleware,
    JwtWsGuard,
  ],
  exports: [
    WsGateway,
    WsAuthMiddleware,
    JwtWsGuard,
  ],
})
export class WsModule {} 