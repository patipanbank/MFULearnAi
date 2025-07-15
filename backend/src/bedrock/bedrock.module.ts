import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { BedrockController } from './bedrock.controller';
import { BedrockService } from './bedrock.service';

@Module({
  imports: [ConfigModule],
  controllers: [BedrockController],
  providers: [BedrockService],
  exports: [BedrockService],
})
export class BedrockModule {} 