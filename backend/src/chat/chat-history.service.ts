import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument } from '../models/chat.model';
import { ChatMessage } from '../models/chat.model';
// เพิ่ม import สำหรับ collection model
import { Collection, CollectionDocument } from '../models/collection.model';

@Injectable()
export class ChatHistoryService {
  constructor(
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel('Collection') private collectionModel: Model<CollectionDocument>, // เพิ่ม collectionModel
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
    collectionNames?: string[],
    systemPrompt?: string,
    temperature?: number,
    maxTokens?: number,
  ): Promise<Chat> {
    try {
      const chatData: any = {
        // robust: แปลง userId เป็น ObjectId เสมอ
        userId: Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : userId,
        name,
        title: name || 'New Chat',
        messages: [],
        isPinned: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (agentId) {
        chatData.agentId = Types.ObjectId.isValid(agentId) ? new Types.ObjectId(agentId) : agentId;
      }
      if (modelId) chatData.modelId = modelId;
      if (systemPrompt) chatData.systemPrompt = systemPrompt;
      if (typeof temperature === 'number') chatData.temperature = temperature;
      if (typeof maxTokens === 'number') chatData.maxTokens = maxTokens;

      // robust: validate collectionNames
      if (collectionNames && collectionNames.length > 0) {
        const collections = await this.collectionModel.find({ name: { $in: collectionNames } }).exec();
        if (collections.length !== collectionNames.length) {
          throw new Error('One or more collections not found');
        }
        chatData.collectionNames = collectionNames;
      }

      const chat = new this.chatModel(chatData);
      const savedChat = await chat.save();
      return savedChat.toJSON();
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