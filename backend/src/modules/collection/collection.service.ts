import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CollectionDocument } from './collection.schema';
import { CollectionPermission } from './collection-permission.enum';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { UserDocument } from '../users/user.schema';

@Injectable()
export class CollectionService {
  constructor(
    @InjectModel('Collection') private readonly collectionModel: Model<CollectionDocument>,
  ) {}

  async getAll(): Promise<CollectionDocument[]> {
    return this.collectionModel.find().lean();
  }

  async findById(id: string): Promise<CollectionDocument | null> {
    return this.collectionModel.findById(id).lean();
  }

  async create(dto: CreateCollectionDto, user: UserDocument): Promise<CollectionDocument> {
    // Validate name
    const name = dto.name.trim();
    if (name.length < 3) throw new BadRequestException('Name too short');
    if (name.length > 100) throw new BadRequestException('Name too long');
    const exists = await this.collectionModel.findOne({ name });
    if (exists) throw new ConflictException('Collection with this name already exists');

    const doc = new this.collectionModel({
      name,
      permission: dto.permission,
      createdBy: user.username,
      department: user.department,
      modelId: dto.modelId,
    });
    return doc.save();
  }

  async update(id: string, dto: UpdateCollectionDto): Promise<CollectionDocument> {
    const updates: any = { ...dto };
    if (updates.name) {
      updates.name = updates.name.trim();
    }
    const updated = await this.collectionModel.findByIdAndUpdate(id, { $set: updates }, { new: true, lean: true });
    if (!updated) throw new NotFoundException('Collection not found');
    return updated;
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.collectionModel.findByIdAndDelete(id);
    if (!deleted) throw new NotFoundException('Collection not found');
  }

  /* Permission helpers */
  canUserAccess(user: UserDocument, collection: CollectionDocument): boolean {
    if (collection.permission === CollectionPermission.PUBLIC) return true;
    if (collection.permission === CollectionPermission.PRIVATE) {
      return collection.createdBy === user.username;
    }
    if (collection.permission === CollectionPermission.DEPARTMENT) {
      return (
        collection.createdBy === user.username ||
        (!!user.department && user.department === collection.department)
      );
    }
    // default false
    return false;
  }

  canUserModify(user: UserDocument, collection: CollectionDocument): boolean {
    if (!!user.roles?.includes('SuperAdmin') || !!user.roles?.includes('Admin')) return true;
    return collection.createdBy === user.username;
  }

  async getUserCollections(user: UserDocument): Promise<CollectionDocument[]> {
    const orQuery = [
      { permission: CollectionPermission.PUBLIC },
      { permission: CollectionPermission.PRIVATE, createdBy: user.username },
      { permission: CollectionPermission.DEPARTMENT, department: user.department },
    ];
    return this.collectionModel.find({ $or: orQuery }).lean();
  }
} 