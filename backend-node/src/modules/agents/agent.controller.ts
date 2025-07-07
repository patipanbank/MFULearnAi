import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, UsePipes } from '@nestjs/common';
import { AgentService } from './agent.service';
import { StreamingAgentOrchestratorService } from './streaming-agent-orchestrator.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { streamingAgentExecutionRequestSchema, StreamingAgentExecutionRequest } from '../../common/schemas';

@UseGuards(JwtAuthGuard)
@Controller('agents')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly streamingAgentOrchestratorService: StreamingAgentOrchestratorService,
  ) {}

  @Get()
  async findAll() {
    return this.agentService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.agentService.findOne(id);
  }

  @Post()
  async create(@Body() body: any) {
    return this.agentService.create(body);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() body: any) {
    return this.agentService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.agentService.delete(id);
  }

  // Streaming execution endpoints
  @Post('execute-streaming')
  @UsePipes(new ZodValidationPipe(streamingAgentExecutionRequestSchema))
  async executeStreaming(@Body() body: StreamingAgentExecutionRequest): Promise<any> {
    return this.streamingAgentOrchestratorService.executeAgentStreaming(body);
  }

  @Get('streaming-status/:sessionId')
  async getStreamingStatus(@Param('sessionId') sessionId: string) {
    return this.streamingAgentOrchestratorService.getStreamingStatus(sessionId);
  }

  @Post('cancel-streaming/:sessionId')
  async cancelStreaming(@Param('sessionId') sessionId: string) {
    await this.streamingAgentOrchestratorService.cancelStreamingExecution(sessionId);
    return { message: 'Streaming execution cancelled', sessionId };
  }
} 