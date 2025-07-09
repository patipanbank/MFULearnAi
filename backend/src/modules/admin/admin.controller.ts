import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { SystemPromptService } from '../system-prompt/system-prompt.service';

@Controller({
  path: 'admins',
  version: '1'
})
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
export class AdminController {
  constructor(private readonly adminService: AdminService, private readonly spService: SystemPromptService) {}

  @Get('all')
  async all() {
    return this.adminService.getAllAdmins();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.adminService.getAdminById(id);
  }

  @Post('create')
  async create(@Body() dto: CreateAdminDto) {
    return this.adminService.createAdmin(dto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.adminService.updateAdmin(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.adminService.deleteAdmin(id);
    return { message: 'Deleted' };
  }

  /* System prompt */
  @Get('system-prompt')
  async getPrompt() {
    return this.spService.getSystemPrompt();
  }

  @Put('system-prompt')
  async updatePrompt(@Body('prompt') prompt: string, /* injecting req? maybe user info later */) {
    return this.spService.updateSystemPrompt(prompt, 'superadmin');
  }
} 