import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { IsString, IsUrl, IsOptional } from 'class-validator';
import { TrainingService } from './training.service';

// DTOs for validation
class FileUploadDto {
  @IsString()
  modelId: string;

  @IsString()
  collectionName: string;
}

class ScrapeUrlDto {
  @IsUrl()
  url: string;

  @IsString()
  modelId: string;

  @IsString()
  collectionName: string;
}

class ProcessTextDto {
  @IsString()
  text: string;

  @IsString()
  documentName: string;

  @IsString()
  modelId: string;

  @IsString()
  collectionName: string;
}

class IngestDirectoryDto {
  @IsString()
  directoryPath: string;

  @IsString()
  collectionName: string;
}

@Controller('training')
@UseGuards(AuthGuard('jwt'))
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  // Route 1: POST /upload - Upload file for training
  @Post('upload')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFileForTraining(
    @Request() req,
    @UploadedFile() file: any,
    @Body(ValidationPipe) uploadDto: FileUploadDto,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      const chunksCount = await this.trainingService.processAndEmbedFile(
        file,
        req.user,
        uploadDto.modelId,
        uploadDto.collectionName,
      );

      return {
        message: 'File processed successfully with vector embeddings',
        chunks: chunksCount,
        file: {
          filename: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Error processing upload: ${error.message}`);
    }
  }

  // Route 2: POST /scrape-url - Scrape URL for training
  @Post('scrape-url')
  @HttpCode(HttpStatus.OK)
  async scrapeUrlForTraining(
    @Request() req,
    @Body(ValidationPipe) scrapeDto: ScrapeUrlDto,
  ) {
    try {
      const chunksCount = await this.trainingService.processAndEmbedUrl(
        scrapeDto.url,
        req.user,
        scrapeDto.modelId,
        scrapeDto.collectionName,
      );

      return {
        message: `URL scraped successfully. ${chunksCount} chunks were added.`,
        chunks: chunksCount,
        url: scrapeDto.url,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error scraping URL');
    }
  }

  // Route 3: POST /text - Process text for training
  @Post('text')
  @HttpCode(HttpStatus.OK)
  async processTextForTraining(
    @Request() req,
    @Body(ValidationPipe) textDto: ProcessTextDto,
  ) {
    try {
      const chunksCount = await this.trainingService.processAndEmbedText(
        textDto.text,
        req.user,
        textDto.modelId,
        textDto.collectionName,
        textDto.documentName,
      );

      return {
        message: `Text processed successfully. ${chunksCount} chunks were added.`,
        chunks: chunksCount,
        document: textDto.documentName,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error processing text');
    }
  }

  // Route 4: POST /ingest-directory - Ingest directory (Admin only)
  @Post('ingest-directory')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestDirectory(
    @Request() req,
    @Body(ValidationPipe) ingestDto: IngestDirectoryDto,
  ) {
    // Check if user is admin
    if (!req.user.role || !['Admin', 'SuperAdmin'].includes(req.user.role)) {
      throw new BadRequestException('Admin privileges required');
    }

    try {
      // Start background task (in production, use proper queue system)
      this.trainingService.ingestDirectory(
        ingestDto.directoryPath,
        ingestDto.collectionName,
        req.user,
      );

      return {
        message: 'Directory ingestion process started in the background.',
        directory: ingestDto.directoryPath,
        collection: ingestDto.collectionName,
      };
    } catch (error) {
      throw new BadRequestException('Error starting directory ingestion');
    }
  }
} 