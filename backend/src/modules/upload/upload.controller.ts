import { Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { StorageService } from '../../infrastructure/storage/storage.service';

@Controller()
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('File missing');
    }
    const key = `${Date.now()}_${file.originalname}`;
    const { url } = await this.storageService.upload(key, file.buffer);
    return { url, mediaType: file.mimetype };
  }
} 