import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatHistoryService } from './chat-history.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../models/user.model';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private chatService: ChatService,
    private chatHistoryService: ChatHistoryService,
  ) {}

  @Get('history')
  async getChatHistory(@Request() req: any): Promise<any> {
    try {
      const userId = req.user.id;
      const chats = await this.chatHistoryService.getChatHistoryForUser(userId);
      return chats; // เปลี่ยนจาก return { success, data, message } เป็น return array ตรงๆ
    } catch (error) {
      throw new HttpException(
        `Failed to get chat history: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':chatId')
  async getChatById(@Param('chatId') chatId: string, @Request() req: any): Promise<any> {
    try {
      const userId = req.user.id;
      const chat = await this.chatHistoryService.getChatById(chatId);
      
      if (!chat) {
        throw new HttpException('Chat not found', HttpStatus.NOT_FOUND);
      }

      if (chat.userId.toString() !== userId) {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      return {
        success: true,
        data: chat,
        message: 'Chat retrieved successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get chat: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async createChat(@Body() createChatDto: any, @Request() req: any): Promise<any> {
    try {
      const userId = req.user.id;
      const { name, agentId, modelId } = createChatDto;

      const chat = await this.chatHistoryService.createChat(
        userId,
        name || 'New Chat',
        agentId,
        modelId,
      );

      return {
        success: true,
        data: chat,
        message: 'Chat created successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create chat: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':chatId/name')
  async updateChatName(
    @Param('chatId') chatId: string,
    @Body() body: { name: string },
    @Request() req: any,
  ): Promise<any> {
    try {
      const userId = req.user.id;
      const chat = await this.chatHistoryService.getChatById(chatId);
      
      if (!chat) {
        throw new HttpException('Chat not found', HttpStatus.NOT_FOUND);
      }

      if (chat.userId.toString() !== userId) {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      const updatedChat = await this.chatHistoryService.updateChatName(chatId, body.name);

      return {
        success: true,
        data: updatedChat,
        message: 'Chat name updated successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update chat name: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':chatId/pin')
  async updateChatPinStatus(
    @Param('chatId') chatId: string,
    @Body() body: { isPinned: boolean },
    @Request() req: any,
  ): Promise<any> {
    try {
      const userId = req.user.id;
      const chat = await this.chatHistoryService.getChatById(chatId);
      
      if (!chat) {
        throw new HttpException('Chat not found', HttpStatus.NOT_FOUND);
      }

      if (chat.userId.toString() !== userId) {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      const updatedChat = await this.chatHistoryService.updateChatPinStatus(chatId, body.isPinned);

      return {
        success: true,
        data: updatedChat,
        message: 'Chat pin status updated successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update chat pin status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':chatId')
  async deleteChat(@Param('chatId') chatId: string, @Request() req: any): Promise<any> {
    try {
      const userId = req.user.id;
      const chat = await this.chatHistoryService.getChatById(chatId);
      
      if (!chat) {
        throw new HttpException('Chat not found', HttpStatus.NOT_FOUND);
      }

      if (chat.userId.toString() !== userId) {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      const deleted = await this.chatHistoryService.deleteChat(chatId);

      if (!deleted) {
        throw new HttpException('Failed to delete chat', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        success: true,
        message: 'Chat deleted successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to delete chat: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':chatId/clear-memory')
  async clearChatMemory(@Param('chatId') chatId: string, @Request() req: any): Promise<any> {
    try {
      const userId = req.user.id;
      const chat = await this.chatHistoryService.getChatById(chatId);
      
      if (!chat) {
        throw new HttpException('Chat not found', HttpStatus.NOT_FOUND);
      }

      if (chat.userId.toString() !== userId) {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      // Clear memory using ChatService
      await this.chatService.clearChatMemory(chatId, userId);

      return {
        success: true,
        message: 'Chat memory cleared successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to clear chat memory: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats/user')
  async getUserChatStats(@Request() req: any): Promise<any> {
    try {
      const userId = req.user.id;
      const stats = await this.chatService.getUserChatStats(userId);

      return {
        success: true,
        data: stats,
        message: 'User chat stats retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get user chat stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('stats/memory')
  @UseGuards(RoleGuard)
  @Roles(UserRole.ADMIN)
  async getMemoryStats(): Promise<any> {
    try {
      const stats = await this.chatService.getMemoryStats();

      return {
        success: true,
        data: stats,
        message: 'Memory stats retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get memory stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('save')
  async saveChat(@Body() saveChatDto: any, @Request() req: any): Promise<any> {
    try {
      const userId = req.user.id;
      const { chatId, messages, name } = saveChatDto;

      let chat;
      if (chatId) {
        // Update existing chat
        chat = await this.chatHistoryService.getChatById(chatId);
        if (!chat) {
          throw new HttpException('Chat not found', HttpStatus.NOT_FOUND);
        }
        if (chat.userId.toString() !== userId) {
          throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
        }
        chat = await this.chatHistoryService.updateChatName(chatId, name);
      } else {
        // Create new chat
        chat = await this.chatHistoryService.createChat(
          userId,
          name || 'New Chat',
          undefined,
          undefined,
        );
      }

      return {
        success: true,
        data: chat,
        message: 'Chat saved successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to save chat: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }


} 