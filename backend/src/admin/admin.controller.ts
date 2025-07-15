import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { RoleGuard, RequireRoles } from '../auth/guards/role.guard';
import { UserRole } from '../models/user.model';

@Controller('admin')
@UseGuards(AuthGuard('jwt'), RoleGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async getAllUsers(@Request() req) {
    return await this.adminService.getAllUsers();
  }

  @Post('users')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async createUser(@Request() req, @Body() userData: any) {
    return await this.adminService.createUser(userData);
  }

  @Put('users/:id')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async updateUser(@Request() req, @Param('id') id: string, @Body() userData: any) {
    return await this.adminService.updateUser(id, userData);
  }

  @Delete('users/:id')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async deleteUser(@Request() req, @Param('id') id: string) {
    await this.adminService.deleteUser(id);
    return { message: 'User deleted successfully' };
  }

  @Get('system-prompts')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async getSystemPrompts(@Request() req) {
    return await this.adminService.getSystemPrompts();
  }

  @Post('system-prompts')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async createSystemPrompt(@Request() req, @Body() prompt: any) {
    return await this.adminService.createSystemPrompt(prompt);
  }

  @Put('system-prompts/:id')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async updateSystemPrompt(@Request() req, @Param('id') id: string, @Body() prompt: any) {
    return await this.adminService.updateSystemPrompt(id, prompt);
  }

  @Delete('system-prompts/:id')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async deleteSystemPrompt(@Request() req, @Param('id') id: string) {
    await this.adminService.deleteSystemPrompt(id);
    return { message: 'System prompt deleted successfully' };
  }
} 