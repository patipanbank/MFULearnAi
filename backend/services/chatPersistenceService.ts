import { HydratedDocument, Types, Document } from 'mongoose'; 
import { Chat } from '../models/Chat'; // Base Chat model
import { ModelModel } from '../models/Model';
import { ChatStats } from '../models/ChatStats';
import { SystemPrompt } from '../models/SystemPrompt';
// Import the User model itself, IUser interface is defined inside User.ts but not exported directly
import UserModel from '../models/User'; // Keep default import

// --- Type Aliases for Clarity (Derived from Mongoose Models) ---

// Get the actual document type from the Chat model
type ChatDocument = InstanceType<typeof Chat>;

// Get the type for the elements within the 'messages' array
// We access the schema's definition for the array elements
type MessageSubdocument = ChatDocument['messages'][number];

// Define type for message input - focusing on fields needed from input
// Exclude fields automatically generated or managed by Mongoose (_id, timestamp set by default)
type MessageInput = Partial<Omit<MessageSubdocument, '_id' | 'timestamp'>> & Required<Pick<MessageSubdocument, 'role' | 'content'>>;

// Infer SystemPrompt document type
type SystemPromptDocument = HydratedDocument<InstanceType<typeof SystemPrompt>>;

// Define PopulatedUser based on IUser if available, otherwise keep minimal
// Assuming IUser is exported from User.ts now based on prior attempts
// If IUser is NOT exported, revert PopulatedUser to the minimal interface:
// interface PopulatedUser { _id: Types.ObjectId | string; username: string; email?: string; }
interface PopulatedUser { 
  _id: Types.ObjectId | string;
  username: string;
  email?: string;
}

// Explicit type for Chat document after populating the userId field
interface PopulatedChatDocument extends Omit<ChatDocument, 'userId'> {
  userId: PopulatedUser;
}

// --- Service Class ---

class ChatPersistenceService {

  // --- Chat CRUD Operations ---

  async saveChat(userId: string, modelId: string, messages: MessageInput[], title?: string): Promise<ChatDocument> {
    try {
      // Add nullish coalescing to ensure content is a string
      const firstMessageContent = messages && messages.length > 0 ? (messages[0].content ?? '') : 'New Chat';
      const chatTitle = title || firstMessageContent.substring(0, 50) || 'New Chat';
      
      const newChat = new Chat({
        userId,
        chatname: chatTitle,
        name: chatTitle, // Still assuming name mirrors chatname for now
        modelId,
        messages,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPinned: false,
      });
      const savedChat = await newChat.save();
      console.log(`Chat saved with ID: ${savedChat._id} for user: ${userId}`);
      return savedChat;
    } catch (error) {
      console.error('Error saving chat:', error);
      throw new Error('Failed to save chat');
    }
  }

  async addMessageToChat(chatId: string, message: MessageInput): Promise<ChatDocument | null> {
    try {
      const chat = await Chat.findByIdAndUpdate(
        chatId,
        {
          $push: { messages: message as any }, // Use 'as any' for simplicity with $push on subdocs if strict types fail
          $set: { updatedAt: new Date() },
        },
        { new: true }
      );
      return chat; // Type is inferred correctly by findByIdAndUpdate
    } catch (error) {
      console.error(`Error adding message to chat ${chatId}:`, error);
      throw new Error('Failed to add message to chat');
    }
  }

  async getChat(chatId: string, userId: string): Promise<ChatDocument | null> {
    try {
      const chat = await Chat.findOne({ _id: chatId, userId: userId });
      return chat;
    } catch (error) {
      console.error(`Error fetching chat ${chatId} for user ${userId}:`, error);
      throw new Error('Failed to fetch chat');
    }
  }

  async getChats(userId: string, page: number = 1, limit: number = 15): Promise<{ chats: ChatDocument[], total: number, pages: number }> {
    try {
      const skip = (page - 1) * limit;
      const total = await Chat.countDocuments({ userId: userId });
      const chats = await Chat.find({ userId: userId })
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit);
        
      return {
        chats,
        total,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error(`Error fetching chats for user ${userId}:`, error);
      throw new Error('Failed to fetch chats');
    }
  }

  async updateChat(chatId: string, userId: string, updateData: Partial<Pick<ChatDocument, 'chatname' | 'modelId' | 'isPinned'>>): Promise<ChatDocument | null> {
    try {
      const allowedUpdates: Partial<ChatDocument> = {};
      if (updateData.chatname) allowedUpdates.chatname = updateData.chatname;
      if (updateData.modelId) allowedUpdates.modelId = updateData.modelId;
      if (updateData.isPinned !== undefined) allowedUpdates.isPinned = updateData.isPinned;

      if (Object.keys(allowedUpdates).length === 0) {
        // Find and return the chat without updating if no valid fields provided
        return Chat.findOne({ _id: chatId, userId: userId });
      }

      allowedUpdates.updatedAt = new Date();

      const chat = await Chat.findOneAndUpdate(
        { _id: chatId, userId: userId },
        { $set: allowedUpdates },
        { new: true }
      );

      return chat;
    } catch (error) {
      console.error(`Error updating chat ${chatId} for user ${userId}:`, error);
      throw new Error('Failed to update chat');
    }
  }

  async deleteChat(chatId: string, userId: string): Promise<boolean> {
    try {
      const result = await Chat.deleteOne({ _id: chatId, userId: userId });
      if (result.deletedCount === 0) {
        console.warn(`Chat not found or user ${userId} cannot delete chat ${chatId}`);
        return false;
      }
      await ChatStats.deleteOne({ chatId });
      return true;
    } catch (error) {
      console.error(`Error deleting chat ${chatId} for user ${userId}:`, error);
      throw new Error('Failed to delete chat');
    }
  }

  async editMessage(chatId: string, userId: string, messageId: string, newContent: string): Promise<ChatDocument | null> {
    try {
      const chat = await Chat.findOne({ _id: chatId, userId: userId });
      if (!chat) {
        console.warn(`Chat ${chatId} not found or user ${userId} cannot edit messages.`);
        return null;
      }

      const message = chat.messages.id(messageId) as MessageSubdocument | null; 

      if (!message || message.role !== 'user') {
         console.warn(`User message ${messageId} not found or is not a user message in chat ${chatId}.`);
         return null;
      }

      message.content = newContent;
      message.updatedAt = new Date(); 
      message.isEdited = true; 
      
      chat.updatedAt = new Date();

      // Save the parent document
      await chat.save();
      console.log(`Message ${messageId} in chat ${chatId} edited by user ${userId}`);
      return chat;
    } catch (error) {
      console.error(`Error editing message ${messageId} in chat ${chatId}:`, error);
      throw new Error('Failed to edit message');
    }
  }

  async recordFeedback(chatId: string, userId: string, messageId: string, feedback: 'like' | 'dislike'): Promise<boolean> {
    try {
      const chat = await Chat.findOne({ _id: chatId, userId: userId });
      if (!chat) {
        console.warn(`Chat ${chatId} not found or user ${userId} cannot give feedback.`);
        return false;
      }

      const message = chat.messages.id(messageId) as MessageSubdocument | null;

      if (!message || message.role !== 'assistant') {
        console.warn(`Assistant message ${messageId} not found or not an assistant message in chat ${chatId} for feedback.`);
        return false;
      }

      message.feedback = feedback; 
      chat.updatedAt = new Date();

      await chat.save();
      console.log(`Feedback (${feedback}) recorded for message ${messageId} in chat ${chatId}`);
      return true;
    } catch (error) {
      console.error(`Error recording feedback for message ${messageId} in chat ${chatId}:`, error);
      throw new Error('Failed to record feedback');
    }
  }

  async togglePinChat(chatId: string, userId: string): Promise<ChatDocument | null> {
    try {
      const chat = await Chat.findOne({ _id: chatId, userId: userId });
      if (!chat) {
        console.warn(`Chat not found or user ${userId} cannot pin/unpin chat ${chatId}`);
        return null;
      }

      chat.isPinned = !chat.isPinned;
      chat.updatedAt = new Date();
      await chat.save();

      console.log(`Chat ${chatId} pin status toggled to ${chat.isPinned} by user ${userId}`);
      return chat;
    } catch (error) {
      console.error(`Error toggling pin for chat ${chatId}:`, error);
      throw new Error('Failed to toggle pin status');
    }
  }

  // --- Admin Operations ---

  // Use the new PopulatedChatDocument type in the signature
  async getAllChatsAdmin(page: number = 1, limit: number = 15): Promise<{ chats: PopulatedChatDocument[], total: number, pages: number }> {
    try {
      const skip = (page - 1) * limit;
      const total = await Chat.countDocuments();
      const chats = await Chat.find()
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate<{ userId: PopulatedUser }>('userId', 'username email') 
        .exec(); 
        
      console.log(`Admin fetched ${chats.length} chats, page ${page}`);
      
      return {
        chats: chats as any as PopulatedChatDocument[],
        total,
        pages: Math.ceil(total / limit)
      };
    } catch (error) {
      console.error('Admin error fetching all chats:', error);
      throw new Error('Failed to fetch all chats for admin');
    }
  }

  // Adjust getChatByIdAdmin similarly if needed
  async getChatByIdAdmin(chatId: string): Promise<PopulatedChatDocument | null> {
    try {
      const chat = await Chat.findById(chatId)
        .populate<{ userId: PopulatedUser }>('userId', 'username email')
        .exec();
        
      return chat as any as PopulatedChatDocument | null;
    } catch (error) {
      console.error(`Admin error fetching chat ${chatId}:`, error);
      throw new Error('Admin failed to fetch chat');
    }
  }

  async deleteChatAdmin(chatId: string): Promise<boolean> {
    try {
      const result = await Chat.deleteOne({ _id: chatId });
      if (result.deletedCount === 0) {
        console.warn(`Admin: Chat not found for deletion ${chatId}`);
        return false;
      }
      console.log(`Admin deleted chat ${chatId}`);
      await ChatStats.deleteOne({ chatId });
      return true;
    } catch (error) {
      console.error(`Admin error deleting chat ${chatId}:`, error);
      throw new Error('Admin failed to delete chat');
    }
  }
  
  // --- System Prompt ---
  async getSystemPrompt(): Promise<string | null> {
    try {
      // Add lean() for potentially better performance and simpler type if full Mongoose doc isn't needed
      const promptDoc = await SystemPrompt.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
      return promptDoc ? promptDoc.prompt : null; 
    } catch (error) {
      console.error('Error fetching active system prompt:', error);
      return null;
    }
  }

  // --- Model Lookup ---
  async findModelById(modelId: string): Promise<{ collections: string[] } | null> {
    try {
      const model = await ModelModel.findById(modelId).select('collections').lean<{ collections: any }>(); 
      if (!model) {
        console.error('Model not found:', modelId);
        return null;
      }
      const collections = Array.isArray(model.collections) ? model.collections.map(String) : [];
      return { collections };
    } catch (error) {
      console.error('Error finding model by ID:', error);
      throw new Error('Failed to find model');
    }
  }
}

export const chatPersistenceService = new ChatPersistenceService();
