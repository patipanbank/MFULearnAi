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
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../models/user.model';

@Controller('admin')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  async getSystemStats(): Promise<any> {
    try {
      const stats = await this.adminService.getSystemStats();
      return {
        success: true,
        data: stats,
        message: 'System stats retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get system stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('users')
  async getAllUsers(): Promise<any> {
    try {
      const users = await this.adminService.getAllUsers();
      return {
        success: true,
        data: users,
        message: 'Users retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get users: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string): Promise<any> {
    try {
      const user = await this.adminService.getUserById(id);

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: user,
        message: 'User retrieved successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get user: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('users/:id/role')
  async updateUserRole(
    @Param('id') id: string,
    @Body() body: { role: string },
  ): Promise<any> {
    try {
      const { role } = body;

      if (!role) {
        throw new HttpException('Role is required', HttpStatus.BAD_REQUEST);
      }

      const user = await this.adminService.updateUserRole(id, role);

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: user,
        message: 'User role updated successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update user role: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put('users/:id/department')
  async updateUserDepartment(
    @Param('id') id: string,
    @Body() body: { department: string },
  ): Promise<any> {
    try {
      const { department } = body;

      if (!department) {
        throw new HttpException('Department is required', HttpStatus.BAD_REQUEST);
      }

      const user = await this.adminService.updateUserDepartment(id, department);

      if (!user) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        data: user,
        message: 'User department updated successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update user department: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string): Promise<any> {
    try {
      const deleted = await this.adminService.deleteUser(id);

      if (!deleted) {
        throw new HttpException('User not found', HttpStatus.NOT_FOUND);
      }

      return {
        success: true,
        message: 'User deleted successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to delete user: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('users/stats')
  async getUserStats(): Promise<any> {
    try {
      const userStats = await this.adminService.getUserStats();
      return {
        success: true,
        data: userStats,
        message: 'User stats retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get user stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  async getSystemHealth(): Promise<any> {
    try {
      const health = await this.adminService.getSystemHealth();
      return {
        success: true,
        data: health,
        message: 'System health retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get system health: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('logs')
  async getSystemLogs(@Body() body: { limit?: number }): Promise<any> {
    try {
      const { limit = 100 } = body;
      const logs = await this.adminService.getSystemLogs(limit);
      return {
        success: true,
        data: logs,
        message: 'System logs retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get system logs: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('cache/clear')
  async clearSystemCache(): Promise<any> {
    try {
      const cleared = await this.adminService.clearSystemCache();

      if (!cleared) {
        throw new HttpException('Failed to clear system cache', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        success: true,
        message: 'System cache cleared successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to clear system cache: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('backup')
  async backupDatabase(): Promise<any> {
    try {
      const backupId = await this.adminService.backupDatabase();
      return {
        success: true,
        data: { backupId },
        message: 'Database backup created successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to create database backup: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 