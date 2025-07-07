import { Controller, Get, Post, Body, Param, UseGuards, Request, Delete } from '@nestjs/common';
import { ChatService } from './chat.service';
import { MemoryService } from '../../services/memory.service';
import { JwtAuthGuard } from '../auth/jwt.guard';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly memoryService: MemoryService,
  ) {}

  @Get()
  async list(@Request() req) {
    return this.chatService.findAllByUser(req.user.userId);
  }

  @Post()
  async create(@Request() req, @Body('name') name: string, @Body('agentId') agentId?: string) {
    return this.chatService.createChat(req.user.userId, name, agentId);
  }

  @Post(':id/messages')
  async addMessage(
    @Param('id') chatId: string,
    @Request() req,
    @Body('content') content: string,
  ) {
    return this.chatService.addMessage(chatId, {
      role: 'user',
      content,
      timestamp: new Date(),
    });
  }

  // --- New route: enqueue chat-worker & return accepted
  @Post(':id/ask')
  async ask(
    @Param('id') chatId: string,
    @Request() req,
    @Body('content') content: string,
    @Body('modelId') modelId?: string,
    @Body('systemPrompt') systemPrompt?: string,
    @Body('temperature') temperature?: number,
    @Body('maxTokens') maxTokens?: number,
  ) {
    // 1) persist user message
    await this.chatService.addMessage(chatId, {
      role: 'user',
      content,
      timestamp: new Date(),
    });

    // 2) enqueue worker job
    await this.chatService.generateAnswer({
      sessionId: chatId,
      userId: req.user.userId,
      message: content,
      modelId,
      systemPrompt,
      temperature,
      maxTokens,
    });

    return { status: 'accepted', channel: `chat:${chatId}` };
  }

  // --- Clear memory for a chat (admin/user)
  @Delete(':id/clear-memory')
  async clearMemory(@Param('id') chatId: string) {
    await this.memoryService.clearChatMemory(chatId);
    return { status: 'cleared' };
  }

  // --- Memory stats (doc count)
  @Get(':id/memory/stats')
  async memoryStats(@Param('id') chatId: string) {
    return this.memoryService.getMemoryStats(chatId);
  }
} 