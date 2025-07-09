import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards, UseInterceptors, UploadedFile, BadRequestException, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CollectionService } from './collection.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CollectionPermission } from './collection-permission.enum';
import { DocumentManagementService } from '../../services/document-management.service';

@Controller({
  path: 'collections',
  version: '1'
})
export class CollectionController {
  constructor(
    private readonly collectionService: CollectionService,
    private readonly documentManagementService: DocumentManagementService
  ) {}

  // List collections accessible to current user
  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Request() req) {
    return this.collectionService.getUserCollections(req.user);
  }

  // List public collections (no auth required)
  @Get('public')
  async listPublic() {
    const all = await this.collectionService.getAll();
    return all.filter((c) => c.permission === CollectionPermission.PUBLIC);
  }

  // Get analytics data
  @Get('analytics')
  @UseGuards(JwtAuthGuard)
  async getAnalytics(@Request() req) {
    const collections = await this.collectionService.getUserCollections(req.user);
    
    // Calculate basic statistics
    let totalDocuments = 0;
    let totalSize = 0;
    
    // For now, return basic stats - can be enhanced later with real document counts
    for (const collection of collections) {
      try {
        const documents = await this.documentManagementService.getDocuments(collection.id, 1000);
        totalDocuments += documents.length;
        // totalSize can be calculated if document service provides size info
      } catch (error) {
        // Skip collections that can't be accessed
        continue;
      }
    }

    return {
      totalCollections: collections.length,
      totalDocuments,
      totalSize // Mock value for now
    };
  }

  // Create collection
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateCollectionDto, @Request() req) {
    return this.collectionService.create(dto, req.user);
  }

  // Update collection
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() dto: UpdateCollectionDto, @Request() req) {
    const col = await this.collectionService.findById(id);
    if (!col) {
      throw new Error('Collection not found');
    }
    if (!this.collectionService.canUserModify(req.user, col)) {
      throw new Error('Not authorized');
    }
    return this.collectionService.update(id, dto);
  }

  // Delete collection
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Request() req) {
    const col = await this.collectionService.findById(id);
    if (!col) {
      throw new Error('Collection not found');
    }
    if (!this.collectionService.canUserModify(req.user, col)) {
      throw new Error('Not authorized');
    }
    await this.collectionService.remove(id);
    return { message: 'Collection deleted' };
  }

  // ========== Document Management Endpoints ==========

  // Upload document to collection
  @Post(':id/documents')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Param('id') collectionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const collection = await this.collectionService.findById(collectionId);
    if (!collection) {
      throw new BadRequestException('Collection not found');
    }

    if (!this.collectionService.canUserModify(req.user, collection)) {
      throw new ForbiddenException('Not authorized to upload to this collection');
    }

    const result = await this.documentManagementService.uploadDocument(
      collectionId,
      file,
      req.user.username
    );

    return {
      message: 'Document uploaded successfully',
      data: result
    };
  }

  // Search documents in collection
  @Get(':id/search')
  @UseGuards(JwtAuthGuard)
  async searchDocuments(
    @Param('id') collectionId: string,
    @Query('q') query: string,
    @Query('limit') limit: string = '10',
    @Query('similarity') minSimilarity: string = '0.7',
    @Request() req
  ) {
    const collection = await this.collectionService.findById(collectionId);
    if (!collection) {
      throw new BadRequestException('Collection not found');
    }

    if (!this.collectionService.canUserAccess(req.user, collection)) {
      throw new ForbiddenException('Not authorized to access this collection');
    }

    if (!query || query.trim().length === 0) {
      throw new BadRequestException('Search query is required');
    }

    const results = await this.documentManagementService.searchDocuments(
      collectionId,
      query.trim(),
      parseInt(limit, 10),
      parseFloat(minSimilarity)
    );

    return {
      message: 'Search completed successfully',
      data: results
    };
  }

  // Get all documents in collection
  @Get(':id/documents')
  @UseGuards(JwtAuthGuard)
  async getDocuments(
    @Param('id') collectionId: string,
    @Query('limit') limit: string = '50',
    @Request() req
  ) {
    const collection = await this.collectionService.findById(collectionId);
    if (!collection) {
      throw new BadRequestException('Collection not found');
    }

    if (!this.collectionService.canUserAccess(req.user, collection)) {
      throw new ForbiddenException('Not authorized to access this collection');
    }

    const documents = await this.documentManagementService.getDocuments(
      collectionId,
      parseInt(limit, 10)
    );

    return {
      message: 'Documents retrieved successfully',
      data: documents
    };
  }

  // Delete document from collection
  @Delete(':id/documents/:documentId')
  @UseGuards(JwtAuthGuard)
  async deleteDocument(
    @Param('id') collectionId: string,
    @Param('documentId') documentId: string,
    @Request() req
  ) {
    const collection = await this.collectionService.findById(collectionId);
    if (!collection) {
      throw new BadRequestException('Collection not found');
    }

    if (!this.collectionService.canUserModify(req.user, collection)) {
      throw new ForbiddenException('Not authorized to delete from this collection');
    }

    await this.documentManagementService.deleteDocument(collectionId, documentId);

    return {
      message: 'Document deleted successfully'
    };
  }

  // Get collection statistics
  @Get(':id/stats')
  @UseGuards(JwtAuthGuard)
  async getCollectionStats(
    @Param('id') collectionId: string,
    @Request() req
  ) {
    const collection = await this.collectionService.findById(collectionId);
    if (!collection) {
      throw new BadRequestException('Collection not found');
    }

    if (!this.collectionService.canUserAccess(req.user, collection)) {
      throw new ForbiddenException('Not authorized to access this collection');
    }

    const stats = await this.documentManagementService.getCollectionStats(collectionId);

    return {
      message: 'Collection statistics retrieved successfully',
      data: {
        collection: {
          id: collection._id,
          name: collection.name,
          permission: collection.permission,
          createdBy: collection.createdBy,
          department: collection.department,
          createdAt: collection.createdAt,
          updatedAt: collection.updatedAt
        },
        documents: stats
      }
    };
  }
} 