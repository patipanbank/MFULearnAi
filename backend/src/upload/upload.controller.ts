import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  UseGuards,
  Request,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { UploadService } from './upload.service';

@Controller('upload')
@UseGuards(AuthGuard('jwt'))
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('single')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingleFile(@Request() req, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!this.uploadService.isValidFileType(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }

    const result = await this.uploadService.uploadFile(file, req.user);
    return {
      message: 'File uploaded successfully',
      file: result,
    };
  }

  @Post('multiple')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultipleFiles(@Request() req, @UploadedFiles() files: any[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    // Filter valid files
    const validFiles = files.filter(file => 
      this.uploadService.isValidFileType(file.mimetype)
    );

    if (validFiles.length === 0) {
      throw new BadRequestException('No valid files to upload');
    }

    const results = await this.uploadService.uploadMultipleFiles(validFiles, req.user);
    return {
      message: `${results.length} files uploaded successfully`,
      files: results,
    };
  }
} 