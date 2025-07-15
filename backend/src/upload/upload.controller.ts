import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { RequireRoles } from '../auth/guards/role.guard';
import { UserRole } from '../models/user.model';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('upload')
@UseGuards(JwtAuthGuard, RoleGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @RequireRoles(UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: any,
    @GetUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File too large (max 10 MB)');
    }

    try {
      const result = await this.uploadService.uploadFile(file, user.id);
      return {
        url: result.url,
        mediaType: result.mediaType,
      };
    } catch (error) {
      throw new BadRequestException(`Upload failed: ${error.message}`);
    }
  }
} 