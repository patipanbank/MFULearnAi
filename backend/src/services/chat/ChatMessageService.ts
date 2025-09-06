import { ChatModel, Chat, ChatMessage } from '../../models/chat';
import { storageService } from '../storageService';
import type { ImageData } from './types/chat-service.types';

export class ChatMessageService {
  constructor() {
    console.log('✅ Chat message service initialized');
  }

  public async addMessage(chatId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      throw new Error(`Chat session ${chatId} not found`);
    }

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      ...message,
      timestamp: new Date()
    };

    chat.messages.push(newMessage);
    chat.updatedAt = new Date();
    await chat.save();

    console.log(`✅ Added message to session ${chatId}`);
    return newMessage;
  }

  public async updateMessage(chatId: string, messageId: string, updates: Partial<ChatMessage>): Promise<void> {
    await ChatModel.updateOne(
      { _id: chatId, 'messages.id': messageId },
      { 
        $set: Object.fromEntries(
          Object.entries(updates).map(([key, value]) => [`messages.$.${key}`, value])
        )
      }
    );
  }

  public async getChatMessages(chatId: string): Promise<ChatMessage[]> {
    const chat = await ChatModel.findById(chatId);
    if (!chat) {
      throw new Error(`Chat session ${chatId} not found`);
    }
    return chat.messages;
  }

  /**
   * เตรียมรูปภาพสำหรับ multimodal processing
   */
  public async prepareImagesForMultimodal(images?: Array<{ url: string; mediaType: string }>): Promise<ImageData[]> {
    if (!images || images.length === 0) {
      return [];
    }

    const preparedImages: ImageData[] = [];
    
    for (const image of images) {
      try {
        console.log(`🖼️ Preparing image for multimodal: ${image.url.substring(0, 50)}...`);
        
        const base64Data = await storageService.getFileAsBase64(image.url);
        
        if (base64Data) {
          preparedImages.push({
            ...image,
            base64Data: base64Data.data
          });
          console.log(`✅ Image prepared successfully: ${base64Data.mediaType}, size: ${Math.round(base64Data.data.length / 1024)}KB`);
        } else {
          console.warn(`⚠️ Failed to prepare image: ${image.url}`);
          preparedImages.push(image);
        }
      } catch (error) {
        console.error(`❌ Error preparing image ${image.url}:`, error);
        preparedImages.push(image);
      }
    }

    return preparedImages;
  }

  /**
   * เตรียม messages สำหรับ AI processing
   */
  public enrichMessagesWithImages(messages: ChatMessage[]): any[] {
    return messages.map(msg => {
      let enrichedContent = msg.content;
      if (msg.role === 'user' && Array.isArray((msg as any).images) && (msg as any).images.length > 0) {
        const imagesDesc = (msg as any).images
          .map((im: any, idx: number) => `#${idx + 1} (${im.mediaType}): ${im.url}`)
          .join('\n');
        enrichedContent = `${enrichedContent}\n\n[Attached images]\n${imagesDesc}`;
      }
      return {
        role: msg.role,
        content: enrichedContent,
        id: msg.id,
        timestamp: msg.timestamp
      };
    });
  }
}

export const chatMessageService = new ChatMessageService();