import { Module } from '@nestjs/common';
import { LangChainChatService } from './langchain-chat.service';

@Module({
  providers: [LangChainChatService],
  exports: [LangChainChatService],
})
export class LangChainModule {} 