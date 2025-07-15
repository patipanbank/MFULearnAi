import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { CollectionService, CreateCollectionDto, UpdateCollectionDto } from './collection.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../models/user.model';

@Controller('collection')
@UseGuards(JwtAuthGuard)
export class CollectionController {
  constructor(private collectionService: CollectionService) {}

  @Get()
  async getAllCollections(@Request() req: any): Promise<any> {
    try {
      const user = req.user;
      let collections;

      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        collections = await this.collectionService.getAllCollections();
      } else {
        collections = await this.collectionService.getUserCollections(user);
      }

      return {
        success: true,
        data: collections,
        message: 'Collections retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get collections: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getCollectionById(@Param('id') id: string, @Request() req: any): Promise<any> {
    try {
      const user = req.user;
      const collection = await this.collectionService.getCollectionById(id);

      if (!collection) {
        throw new HttpException('Collection not found', HttpStatus.NOT_FOUND);
      }

      if (!this.collectionService.canUserAccessCollection(user, collection)) {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      return {
        success: true,
        data: collection,
        message: 'Collection retrieved successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to get collection: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async createCollection(@Body() body: CreateCollectionDto, @Request() req: any): Promise<any> {
    try {
      const user = req.user;
      const { name, permission, modelId } = body;

      if (!name || !permission) {
        throw new HttpException('Name and permission are required', HttpStatus.BAD_REQUEST);
      }

      const collection = await this.collectionService.createCollection(
        name,
        permission,
        user,
        modelId,
      );

      return {
        success: true,
        data: collection,
        message: 'Collection created successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to create collection: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put(':id')
  async updateCollection(
    @Param('id') id: string,
    @Body() body: UpdateCollectionDto,
    @Request() req: any,
  ): Promise<any> {
    try {
      const user = req.user;
      const collection = await this.collectionService.getCollectionById(id);

      if (!collection) {
        throw new HttpException('Collection not found', HttpStatus.NOT_FOUND);
      }

      if (!this.collectionService.canUserModifyCollection(user, collection)) {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      const updatedCollection = await this.collectionService.updateCollection(id, body);

      if (!updatedCollection) {
        throw new HttpException('Failed to update collection', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        success: true,
        data: updatedCollection,
        message: 'Collection updated successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to update collection: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  async deleteCollection(@Param('id') id: string, @Request() req: any): Promise<any> {
    try {
      const user = req.user;
      const collection = await this.collectionService.getCollectionById(id);

      if (!collection) {
        throw new HttpException('Collection not found', HttpStatus.NOT_FOUND);
      }

      if (!this.collectionService.canUserModifyCollection(user, collection)) {
        throw new HttpException('Access denied', HttpStatus.FORBIDDEN);
      }

      const deleted = await this.collectionService.deleteCollection(id);

      if (!deleted) {
        throw new HttpException('Failed to delete collection', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        success: true,
        message: 'Collection deleted successfully',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `Failed to delete collection: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('user/collections')
  async getUserCollections(@Request() req: any): Promise<any> {
    try {
      const user = req.user;
      const collections = await this.collectionService.getUserCollections(user);

      return {
        success: true,
        data: collections,
        message: 'User collections retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get user collections: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('department/:department')
  @UseGuards(RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getCollectionsByDepartment(@Param('department') department: string): Promise<any> {
    try {
      const collections = await this.collectionService.getCollectionsByDepartment(department);

      return {
        success: true,
        data: collections,
        message: 'Department collections retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get department collections: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('creator/:username')
  @UseGuards(RoleGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getCollectionsByCreator(@Param('username') username: string): Promise<any> {
    try {
      const collections = await this.collectionService.getCollectionsByCreator(username);

      return {
        success: true,
        data: collections,
        message: 'Creator collections retrieved successfully',
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get creator collections: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 