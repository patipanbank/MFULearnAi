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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { 
  AgentService, 
  CreateAgentDto, 
  UpdateAgentDto, 
  GetAgentsQuery 
} from './agent.service';

export class CreateFromTemplateDto {
  templateId: string;
  name?: string;
  description?: string;
  systemPrompt?: string;
  modelId?: string;
  collectionNames?: string[];
  tools?: any[];
  temperature?: number;
  maxTokens?: number;
  isPublic?: boolean;
  tags?: string[];
}

export class RateAgentDto {
  rating: number;
}

@Controller('agents')
@UseGuards(AuthGuard('jwt'))
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createAgent(
    @Request() req,
    @Body(ValidationPipe) createAgentDto: CreateAgentDto,
  ) {
    return this.agentService.createAgent(req.user.id, createAgentDto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async getAgents(@Query() query: GetAgentsQuery) {
    return this.agentService.getAgents(query);
  }

  @Get('my-agents')
  @HttpCode(HttpStatus.OK)
  async getUserAgents(@Request() req, @Query() query: GetAgentsQuery) {
    return this.agentService.getUserAgents(req.user.id, query);
  }

  @Get('public')
  @HttpCode(HttpStatus.OK)
  async getPublicAgents(@Query() query: GetAgentsQuery) {
    return this.agentService.getPublicAgents(query);
  }

  @Get('templates')
  @HttpCode(HttpStatus.OK)
  async getAgentTemplates() {
    return this.agentService.getAgentTemplates();
  }

  // NEW: POST /from-template - สร้าง agent จาก template (เหมือน FastAPI)
  @Post('from-template')
  @HttpCode(HttpStatus.CREATED)
  async createAgentFromTemplate(
    @Request() req,
    @Body(ValidationPipe) createFromTemplateDto: CreateFromTemplateDto,
  ) {
    const { templateId, ...customizations } = createFromTemplateDto;
    
    const newAgent = await this.agentService.createAgentFromTemplate(
      templateId,
      req.user.id,
      customizations,
    );

    return {
      message: 'Agent created from template successfully',
      agent: newAgent,
    };
  }

  @Get('search')
  @HttpCode(HttpStatus.OK)
  async searchAgents(
    @Query('q') searchTerm: string,
    @Query('limit') limit: number = 10,
  ) {
    return this.agentService.searchAgents(searchTerm, limit);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getAgentById(@Request() req, @Param('id') agentId: string) {
    return this.agentService.getAgentById(agentId, req.user.id);
  }

  @Get(':id/stats')
  @HttpCode(HttpStatus.OK)
  async getAgentStats(@Param('id') agentId: string) {
    return this.agentService.getAgentStats(agentId);
  }

  @Put(':id')
  @HttpCode(HttpStatus.OK)
  async updateAgent(
    @Request() req,
    @Param('id') agentId: string,
    @Body(ValidationPipe) updateAgentDto: UpdateAgentDto,
  ) {
    return this.agentService.updateAgent(agentId, req.user.id, updateAgentDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAgent(@Request() req, @Param('id') agentId: string) {
    await this.agentService.deleteAgent(agentId, req.user.id);
  }

  @Post(':id/use')
  @HttpCode(HttpStatus.OK)
  async incrementUsageCount(@Request() req, @Param('id') agentId: string) {
    await this.agentService.incrementUsageCount(agentId, req.user.id);
    return { message: 'Usage count incremented' };
  }

  // NEW: POST /{agent_id}/rate - ให้คะแนน agent (เหมือน FastAPI)
  @Post(':id/rate')
  @HttpCode(HttpStatus.OK)
  async rateAgent(
    @Request() req,
    @Param('id') agentId: string,
    @Body(ValidationPipe) rateAgentDto: RateAgentDto,
  ) {
    const updatedAgent = await this.agentService.rateAgent(
      agentId,
      req.user.id,
      rateAgentDto.rating,
    );

    return {
      message: 'Rating updated successfully',
      agent: updatedAgent,
      ratedBy: req.user.id,
    };
  }

  @Get('health')
  @HttpCode(HttpStatus.OK)
  health() {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
      service: 'agent',
    };
  }
} 