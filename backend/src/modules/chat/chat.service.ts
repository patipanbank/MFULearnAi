import { Injectable, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChatDocument, MessageDocument } from './chat.schema';
import { Queue } from 'bullmq';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel('Chat') private readonly chatModel: Model<ChatDocument>,
    @Inject('BULL_QUEUE') private readonly queue: Queue,
  ) {}

  async findAllByUser(userId: string) {
    return this.chatModel.find({ userId });
  }

  async createChat(userId: string, name: string, agentId?: string) {
    return this.chatModel.create({ userId, name, agentId, messages: [] });
  }

  async addMessage(chatId: string, message: Partial<MessageDocument>) {
    return this.chatModel.findByIdAndUpdate(
      chatId,
      { $push: { messages: message }, $set: { updatedAt: new Date() } },
      { new: true },
    );
  }

  async getChatById(chatId: string) {
    return this.chatModel.findById(chatId);
  }

  async generateAnswer(payload: any) {
    await this.queue.add('chat-worker', payload);
  }
} 