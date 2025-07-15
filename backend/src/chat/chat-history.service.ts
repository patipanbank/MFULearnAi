import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Chat, ChatDocument } from '../models/chat.model';
import { ChatMessage } from '../models/chat.model';

@Injectable()
export class ChatHistoryService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
  ) {}

  async getChatHistoryForUser(userId: string): Promise<Chat[]> {
    try {
      const chats = await this.chatModel
        .find({ userId })
        .sort({ updatedAt: -1 })
        .exec();
      return chats;
    } catch (error) {
      throw new Error(`Failed to get chat history for user: ${error.message}`);
    }
  }

  async getChatById(chatId: string): Promise<Chat | null> {
    try {
      const chat = await this.chatModel.findById(chatId).exec();
      return chat;
    } catch (error) {
      throw new Error(`Failed to get chat by ID: ${error.message}`);
    }
  }

  async createChat(
    userId: string,
    name: string,
    agentId?: string,
    modelId?: string,
  ): Promise<Chat> {
    try {
      const chatData = {
        userId,
        name,
        messages: [],
        isPinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Prefer agentId over modelId
      if (agentId) {
        chatData['agentId'] = agentId;
      } else if (modelId) {
        chatData['modelId'] = modelId;
      }

      const chat = new this.chatModel(chatData);
      const savedChat = await chat.save();
      return savedChat;
    } catch (error) {
      throw new Error(`Failed to create chat: ${error.message}`);
    }
  }

  async addMessageToChat(chatId: string, message: ChatMessage): Promise<Chat | null> {
    try {
      const result = await this.chatModel.findByIdAndUpdate(
        chatId,
        {
          $push: { messages: message },
          $set: { updatedAt: new Date() },
        },
        { new: true }
      ).exec();
      return result;
    } catch (error) {
      throw new Error(`Failed to add message to chat: ${error.message}`);
    }
  }

  async deleteChat(chatId: string): Promise<boolean> {
    try {
      const result = await this.chatModel.findByIdAndDelete(chatId).exec();
      return !!result;
    } catch (error) {
      throw new Error(`Failed to delete chat: ${error.message}`);
    }
  }

  async updateChatName(chatId: string, name: string): Promise<Chat | null> {
    try {
      const result = await this.chatModel.findByIdAndUpdate(
        chatId,
        {
          $set: { name, updatedAt: new Date() },
        },
        { new: true }
      ).exec();
      return result;
    } catch (error) {
      throw new Error(`Failed to update chat name: ${error.message}`);
    }
  }

  async updateChatPinStatus(chatId: string, isPinned: boolean): Promise<Chat | null> {
    try {
      const result = await this.chatModel.findByIdAndUpdate(
        chatId,
        {
          $set: { isPinned, updatedAt: new Date() },
        },
        { new: true }
      ).exec();
      return result;
    } catch (error) {
      throw new Error(`Failed to update chat pin status: ${error.message}`);
    }
  }
} 