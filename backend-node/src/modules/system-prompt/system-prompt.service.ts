import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SystemPromptDocument } from './system-prompt.schema';

@Injectable()
export class SystemPromptService {
  constructor(@InjectModel('SystemPrompt') private readonly model: Model<SystemPromptDocument>) {}

  async getSystemPrompt() {
    let prompt = await this.model.findOne().lean();
    if (!prompt) {
      const created = await this.model.create({ prompt: 'You are a helpful assistant.', updatedBy: 'system' });
      prompt = created.toObject() as any;
    }
    return prompt;
  }

  async updateSystemPrompt(prompt: string, updatedBy: string) {
    const updated = await this.model.findOneAndUpdate({}, { $set: { prompt, updatedBy, updatedAt: new Date() } }, { new: true, upsert: true, lean: true });
    return updated;
  }
} 