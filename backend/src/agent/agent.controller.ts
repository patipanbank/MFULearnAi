import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('agents')
@UseGuards(JwtAuthGuard)
export class AgentController {
  constructor(private agentService: AgentService) {}

  @Get()
  async getAllAgents(@Request() req: any): Promise<any> {
    try {
      const agents = await this.agentService.getAllAgents();
      return agents; // เปลี่ยนจาก return { success, data, message } เป็น return array ตรงๆ
    } catch (error) {
      throw new HttpException(
        `Failed to get agents: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('public')
  async getPublicAgents(): Promise<any> {
    try {
      const agents = await this.agentService.getPublicAgents();
      return agents; // เปลี่ยนจาก return { success, data, message } เป็น return array ตรงๆ
    } catch (error) {
      throw new HttpException(
        `Failed to get public agents: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('my')
  async getMyAgents(@Request() req: any): Promise<any> {
    try {
      const userId = req.user.id;
      const agents = await this.agentService.getAgentsByUserId(userId);
      return agents; // เปลี่ยนจาก return { success, data, message } เป็น return array ตรงๆ
    } catch (error) {
      throw new HttpException(
        `Failed to get user agents: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':agentId')
  async getAgentById(@Param('agentId') agentId: string, @Request() req: any): Promise<any> {
    try {
      const userId = req.user.id;
      const agent = await this.agentService.getAgentById(agentId, userId);
      
      if (!agent) {
        throw new HttpException('Agent not found or access denied', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: agent,
        message: 'Agent retrieved successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get agent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async createAgent(@Body() createAgentDto: any, @Request() req: any): Promise<any> {
    try {
      const userId = req.user.id;
      const agentData = {
        ...createAgentDto,
        createdBy: userId,
        userId: userId,
      };

      const agent = await this.agentService.createAgent(agentData);

      return {
        success: true,
        data: agent,
        message: 'Agent created successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create agent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':agentId')
  async updateAgent(
    @Param('agentId') agentId: string,
    @Body() updateAgentDto: any,
    @Request() req: any,
  ): Promise<any> {
    try {
      const userId = req.user.id;
      const agent = await this.agentService.getAgentById(agentId, userId);
      
      if (!agent) {
        throw new HttpException('Agent not found or access denied', HttpStatus.NOT_FOUND);
      }

      const updatedAgent = await this.agentService.updateAgent(agentId, updateAgentDto);

      return {
        success: true,
        data: updatedAgent,
        message: 'Agent updated successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update agent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':agentId')
  async deleteAgent(@Param('agentId') agentId: string, @Request() req: any): Promise<any> {
    try {
      const userId = req.user.id;
      const agent = await this.agentService.getAgentById(agentId, userId);
      
      if (!agent) {
        throw new HttpException('Agent not found or access denied', HttpStatus.NOT_FOUND);
      }

      const deleted = await this.agentService.deleteAgent(agentId);

      if (!deleted) {
        throw new HttpException('Failed to delete agent', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        success: true,
        message: 'Agent deleted successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to delete agent: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':agentId/increment-usage')
  async incrementUsageCount(@Param('agentId') agentId: string, @Request() req: any): Promise<any> {
    try {
      const userId = req.user.id;
      const agent = await this.agentService.getAgentById(agentId, userId);
      
      if (!agent) {
        throw new HttpException('Agent not found or access denied', HttpStatus.NOT_FOUND);
      }

      await this.agentService.incrementUsageCount(agentId);

      return {
        success: true,
        message: 'Agent usage count incremented successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to increment usage count: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 