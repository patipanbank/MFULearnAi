import { Module, forwardRef } from '@nestjs/common';
import { LangChainChatService } from './langchain-chat.service';
import { ConfigModule } from '../config/config.module';
import { BedrockModule } from '../bedrock/bedrock.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    ConfigModule,
    BedrockModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [],
  providers: [LangChainChatService],
  exports: [LangChainChatService],
})
export class LangChainModule {} 