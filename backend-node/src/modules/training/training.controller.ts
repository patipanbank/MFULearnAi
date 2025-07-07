import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { TrainingService } from './training.service';
import axios from 'axios';

@Controller('training')
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 20 * 1024 * 1024 },
    }),
  )
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new Error('No file');
    const chunks = await this.trainingService.processBuffer(file.buffer, file.originalname);
    return { message: 'File processed', chunks };
  }

  @Post('text')
  async text(@Body('text') text: string) {
    const chunks = await this.trainingService.processRawText(text);
    return { message: 'Text processed', chunks };
  }

  @Post('scrape-url')
  async scrape(@Body('url') url: string) {
    const resp = await axios.get(url);
    const chunks = await this.trainingService.processUrlContent(resp.data, url);
    return { message: 'URL scraped', chunks };
  }
} 