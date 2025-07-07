import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { CollectionPermission } from '../collection-permission.enum';

export class CreateCollectionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(CollectionPermission)
  permission: CollectionPermission;

  @IsOptional()
  @IsString()
  modelId?: string;
} 