import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemPromptSchema } from './system-prompt.schema';
import { SystemPromptService } from './system-prompt.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: 'SystemPrompt', schema: SystemPromptSchema }])],
  providers: [SystemPromptService],
  exports: [SystemPromptService],
})
export class SystemPromptModule {} 