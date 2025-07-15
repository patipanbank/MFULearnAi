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
  HttpCode,
  HttpStatus,
  ValidationPipe,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { 
  ChatService, 
  CreateChatDto, 
  SendMessageDto, 
  GetChatsQuery 
} from './chat.service';

export class UpdateChatNameDto {
  chat_id: string;
  name: string;
}

export class PinChatDto {
  isPinned: boolean;
}

@Controller('chat')
@UseGuards(AuthGuard('jwt'))
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // Route 1: GET /history/{session_id} - ดึงประวัติการสนทนาของ session เฉพาะ
  @Get('history/:session_id')
  @HttpCode(HttpStatus.OK)
  async getChatHistory(@Request() req, @Param('session_id') sessionId: string) {
    return this.chatService.getChatHistory(sessionId, req.user.id);
  }

  // Route 2: GET /history - ดึงประวัติการสนทนาทั้งหมดของ user
  @Get('history')
  @HttpCode(HttpStatus.OK)
  async getUserChatHistory(@Request() req) {
    // Use existing getChats method to get all user chats
    const query: GetChatsQuery = { userId: req.user.id };
    return this.chatService.getChats(query);
  }

  // Route 3: WebSocket /ws - handled by WebSocket Gateway (already implemented)

  // Route 4: DELETE /{chat_id} - ลบการสนทนา
  @Delete(':chat_id')
  @HttpCode(HttpStatus.OK)
  async deleteChat(@Request() req, @Param('chat_id') chatId: string) {
    await this.chatService.deleteChat(chatId, req.user.id);
    return { message: 'Chat deleted successfully' };
  }

  // Route 5: POST /update-name - อัปเดตชื่อการสนทนา
  @Post('update-name')
  @HttpCode(HttpStatus.OK)
  async updateChatName(
    @Request() req,
    @Body(ValidationPipe) updateChatNameDto: UpdateChatNameDto,
  ) {
    // Use existing updateChatTitle method
    return this.chatService.updateChatTitle(
      updateChatNameDto.chat_id,
      req.user.id,
      updateChatNameDto.name,
    );
  }

  // Route 6: POST /{chat_id}/pin - ปักหมุดการสนทนา
  @Post(':chat_id/pin')
  @HttpCode(HttpStatus.OK)
  async pinChat(
    @Request() req,
    @Param('chat_id') chatId: string,
    @Body(ValidationPipe) pinChatDto: PinChatDto,
  ) {
    const updatedChat = await this.chatService.pinChat(
      chatId,
      req.user.id,
      pinChatDto.isPinned,
    );
    return {
      message: `Chat ${pinChatDto.isPinned ? 'pinned' : 'unpinned'} successfully`,
      chat: updatedChat,
    };
  }

  // Route 7: POST /{chat_id}/clear-memory - ล้างหน่วยความจำ
  @Post(':chat_id/clear-memory')
  @HttpCode(HttpStatus.OK)
  async clearChatMemory(@Request() req, @Param('chat_id') chatId: string) {
    // Use actual clearChatMemory from ChatService (เหมือน FastAPI)
    await this.chatService.clearChatMemory(chatId, req.user.id);
    return { message: 'Chat memory cleared successfully' };
  }

  // Route 8: GET /memory/stats - ดู stats ของหน่วยความจำ (admin only)
  @Get('memory/stats')
  @HttpCode(HttpStatus.OK)
  async getMemoryStats(@Request() req) {
    // CRITICAL SECURITY FIX: Add admin role check
    const userRole = req.user?.role?.toLowerCase();
    if (userRole !== 'admin' && userRole !== 'super_admin') {
      throw new ForbiddenException('Access denied. Admin role required to view memory statistics.');
    }
    
    // Use actual getMemoryStats from ChatService (เหมือน FastAPI)
    return this.chatService.getMemoryStats();
  }
} 