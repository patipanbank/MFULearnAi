import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DepartmentService } from './department.service';
import { RoleGuard, RequireRoles } from '../auth/guards/role.guard';
import { UserRole } from '../models/user.model';

@Controller('departments')
@UseGuards(AuthGuard('jwt'), RoleGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  async getAllDepartments(@Request() req) {
    return await this.departmentService.getAllDepartments();
  }

  @Get(':id')
  async getDepartmentById(@Request() req, @Param('id') id: string) {
    return await this.departmentService.getDepartmentById(id);
  }

  @Post()
  @RequireRoles(UserRole.SUPER_ADMIN)
  async createDepartment(@Request() req, @Body() body: { name: string }) {
    return await this.departmentService.createDepartment(body.name);
  }

  @Put(':id')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async updateDepartment(@Request() req, @Param('id') id: string, @Body() body: { name: string }) {
    return await this.departmentService.updateDepartment(id, body.name);
  }

  @Delete(':id')
  @RequireRoles(UserRole.SUPER_ADMIN)
  async deleteDepartment(@Request() req, @Param('id') id: string) {
    await this.departmentService.deleteDepartment(id);
    return { message: 'Department deleted successfully' };
  }
} 