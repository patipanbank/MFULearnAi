import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller({
  path: 'departments',
  version: '1'
})
export class DepartmentController {
  constructor(private readonly deptService: DepartmentService) {}

  @Get()
  async list() {
    return this.deptService.findAll();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.deptService.findById(id);
  }

  @Post()
  @Roles('SuperAdmin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async create(@Body() dto: CreateDepartmentDto) {
    return this.deptService.create(dto);
  }

  @Put(':id')
  @Roles('SuperAdmin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.deptService.update(id, dto);
  }

  @Delete(':id')
  @Roles('SuperAdmin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async remove(@Param('id') id: string) {
    return this.deptService.delete(id);
  }
} 