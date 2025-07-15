import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { DepartmentService, CreateDepartmentDto, UpdateDepartmentDto } from './department.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../models/user.model';

@Controller('department')
@UseGuards(JwtAuthGuard)
export class DepartmentController {
  constructor(private departmentService: DepartmentService) {}

  @Get()
  async getAllDepartments(): Promise<any> {
    try {
      const departments = await this.departmentService.getAllDepartments();
      return {
        success: true,
        data: departments,
        message: 'Departments retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get departments: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getDepartmentById(@Param('id') id: string): Promise<any> {
    try {
      const department = await this.departmentService.getDepartmentById(id);

      if (!department) {
        throw new HttpException('Department not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: department,
        message: 'Department retrieved successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get department: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  @UseGuards(RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async createDepartment(@Body() body: CreateDepartmentDto): Promise<any> {
    try {
      const { name, description } = body;

      if (!name) {
        throw new HttpException('Department name is required', HttpStatus.BAD_REQUEST);
      }

      const department = await this.departmentService.createDepartment({
        name,
        description,
      });

      return {
        success: true,
        data: department,
        message: 'Department created successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to create department: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  @UseGuards(RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async updateDepartment(
    @Param('id') id: string,
    @Body() body: UpdateDepartmentDto,
  ): Promise<any> {
    try {
      const department = await this.departmentService.updateDepartment(id, body);

      if (!department) {
        throw new HttpException('Department not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: department,
        message: 'Department updated successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update department: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @UseGuards(RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async deleteDepartment(@Param('id') id: string): Promise<any> {
    try {
      const department = await this.departmentService.deleteDepartment(id);

      if (!department) {
        throw new HttpException('Department not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: department,
        message: 'Department deleted successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to delete department: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('name/:name')
  async getDepartmentByName(@Param('name') name: string): Promise<any> {
    try {
      const department = await this.departmentService.getDepartmentByName(name);

      if (!department) {
        throw new HttpException('Department not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: department,
        message: 'Department retrieved successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get department: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('ensure')
  @UseGuards(RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async ensureDepartmentExists(@Body() body: { name: string }): Promise<any> {
    try {
      const { name } = body;

      if (!name) {
        throw new HttpException('Department name is required', HttpStatus.BAD_REQUEST);
      }

      const department = await this.departmentService.ensureDepartmentExists(name);

      return {
        success: true,
        data: department,
        message: 'Department ensured successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to ensure department: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('validate/:name')
  async validateDepartmentName(@Param('name') name: string): Promise<any> {
    try {
      const isValid = await this.departmentService.validateDepartmentName(name);

      return {
        success: true,
        data: { isValid, name },
        message: 'Department name validation completed',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to validate department name: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 