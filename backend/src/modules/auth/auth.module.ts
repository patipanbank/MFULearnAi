import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtStrategy } from './jwt.strategy';
import { AuthController } from './auth.controller';
import { SamlController } from './saml.controller';
import { UserModule } from '../users/user.module';
import { SamlStrategy } from './saml.strategy';
import { RefreshTokenSchema } from './refresh-token.schema';
import { RefreshTokenService } from './refresh-token.service';

@Module({
  imports: [
    PassportModule,
    UserModule,
    MongooseModule.forFeature([
      { name: 'RefreshToken', schema: RefreshTokenSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret-key',
      signOptions: { expiresIn: '1h' },
    }),
  ],
  controllers: [AuthController, SamlController],
  providers: [JwtStrategy, SamlStrategy, RefreshTokenService],
  exports: [JwtModule, PassportModule, UserModule, SamlStrategy],
})
export class AuthModule {} 