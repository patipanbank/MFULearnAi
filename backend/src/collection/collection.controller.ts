import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CollectionService, CreateCollectionDto, UpdateCollectionDto } from './collection.service';
import { CollectionPermission } from '../models/collection.model';
import { IsString, IsEnum, IsOptional, IsArray } from 'class-validator';
import { RoleGuard, RequireRoles } from '../auth/guards/role.guard';
import { UserRole } from '../models/user.model';

// DTOs for validation
class CreateCollectionRequestDto {
  @IsString()
  name: string;

  @IsEnum(CollectionPermission)
  permission: CollectionPermission;

  @IsOptional()
  @IsString()
  modelId?: string;
}

class UpdateCollectionRequestDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(CollectionPermission)
  permission?: CollectionPermission;
}

class DeleteDocumentsDto {
  @IsArray()
  @IsString({ each: true })
  document_ids: string[];
}

@Controller('collections')
@UseGuards(AuthGuard('jwt'), RoleGuard)
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  // Route 1: GET / - Get all collections for current user
  @Get()
  @HttpCode(HttpStatus.OK)
  @RequireRoles(UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS)
  async getAllCollections(@Request() req) {
    const collections = await this.collectionService.getUserCollections(req.user);
    return collections;
  }

  // Route 2: GET /public - Get public collections (no auth required)
  @Get('public')
  @HttpCode(HttpStatus.OK)
  async getPublicCollections() {
    // ไม่จำเป็นต้องมี authentication สำหรับ public collections
    try {
      const collections = await this.collectionService.getPublicCollections();
      return collections;
    } catch (error) {
      // Return empty list instead of error to prevent resource exhaustion
      return [];
    }
  }

  // Route 3: POST / - Create new collection
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequireRoles(UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS)
  async createNewCollection(
    @Request() req,
    @Body(ValidationPipe) createCollectionDto: CreateCollectionRequestDto,
  ) {
    try {
      const newCollection = await this.collectionService.createCollection(
        createCollectionDto.name,
        createCollectionDto.permission,
        req.user,
        createCollectionDto.modelId,
      );

      return newCollection;
    } catch (error) {
      throw new BadRequestException(`Failed to create collection: ${error.message}`);
    }
  }

  // Route 4: PUT /{collection_id} - Update collection
  @Put(':collection_id')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS)
  async updateExistingCollection(
    @Request() req,
    @Param('collection_id') collectionId: string,
    @Body(ValidationPipe) updateCollectionDto: UpdateCollectionRequestDto,
  ) {
    const collection = await this.collectionService.getCollectionById(collectionId);
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    if (!this.collectionService.canUserModifyCollection(req.user, collection)) {
      throw new ForbiddenException('Not authorized to update this collection');
    }

    const updates = updateCollectionDto; // .model_dump(exclude_unset=True) equivalent
    const updatedCollection = await this.collectionService.updateCollection(
      collectionId,
      updates,
    );

    return updatedCollection;
  }

  // Route 5: DELETE /{collection_id} - Delete collection
  @Delete(':collection_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireRoles(UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS)
  async deleteExistingCollection(
    @Request() req,
    @Param('collection_id') collectionId: string,
  ) {
    const collection = await this.collectionService.getCollectionById(collectionId);
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    if (!this.collectionService.canUserModifyCollection(req.user, collection)) {
      throw new ForbiddenException('Not authorized to delete this collection');
    }

    try {
      await this.collectionService.deleteCollection(collection, req.user);
    } catch (error) {
      throw new BadRequestException(`Failed to delete collection: ${error.message}`);
    }
  }

  // Route 6: GET /{collection_id}/documents - Get documents in collection
  @Get(':collection_id/documents')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS)
  async getDocumentsInCollection(
    @Request() req,
    @Param('collection_id') collectionId: string,
    @Query('limit') limit: number = 100,
    @Query('offset') offset: number = 0,
  ) {
    try {
      const collection = await this.collectionService.getCollectionById(collectionId);
      if (!collection) {
        throw new NotFoundException('Collection not found');
      }

      if (!this.collectionService.canUserAccessCollection(req.user, collection)) {
        throw new ForbiddenException('Not authorized to view documents in this collection');
      }

      const documents = await this.collectionService.getDocuments(collection.name, limit, offset);
      return documents;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      console.error(`Error getting documents for collection ${collectionId}: ${error}`);
      throw new BadRequestException(`Failed to get documents: ${error.message}`);
    }
  }

  // Route 7: DELETE /{collection_id}/documents - Delete documents from collection
  @Delete(':collection_id/documents')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS)
  async deleteDocumentsFromCollection(
    @Request() req,
    @Param('collection_id') collectionId: string,
    @Body(ValidationPipe) deleteDocumentsDto: DeleteDocumentsDto,
  ) {
    const collection = await this.collectionService.getCollectionById(collectionId);
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }

    if (!this.collectionService.canUserModifyCollection(req.user, collection)) {
      throw new ForbiddenException('Not authorized to delete documents from this collection');
    }

    try {
      await this.collectionService.deleteDocuments(collection.name, deleteDocumentsDto.document_ids);

      return {
        message: `${deleteDocumentsDto.document_ids.length} documents deleted successfully.`,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to delete documents: ${error.message}`);
    }
  }

  // Route 8: GET /analytics - Get collection analytics
  @Get('analytics')
  @HttpCode(HttpStatus.OK)
  @RequireRoles(UserRole.STAFFS, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.STUDENTS)
  async getCollectionAnalytics(@Request() req) {
    try {
      const analytics = await this.collectionService.getCollectionAnalytics();
      return analytics;
    } catch (error) {
      throw new BadRequestException(`Failed to get analytics: ${error.message}`);
    }
  }
} 